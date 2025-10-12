const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const Child = require("../models/Child");
const User = require("../models/User");

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error("Auth token required"));
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      socket.user = payload; // contains userId/role or childId/role depending on token
      return next();
    } catch (err) {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const u = socket.user || {};
    // Determine rooms based on role
    try {
      if (u.role === "child") {
        // Child token: childId and parentId expected
        const childId = u.childId || u.childid || u.child;
        const parentId = u.parentId || u.parentid || u.parent;
        if (childId) socket.join(`child:${childId}`);
        if (parentId) socket.join(`parent:${parentId}`);
        socket.join(`conversation:parent:${parentId}:child:${childId}`);
      } else {
        // Parent / user token
        const parentId = u.userId || u.userID || u.id;
        if (parentId) socket.join(`parent:${parentId}`);
      }
    } catch (e) {
      console.warn("socket join failed", e);
    }

    socket.on("send_message", async (payload, cb) => {
      // payload: { parentId, childId, content }
      try {
        if (!payload || !payload.content)
          return cb && cb({ status: false, message: "content required" });
        const parentId = payload.parentId;
        const childId = payload.childId;
        if (!parentId || !childId)
          return (
            cb &&
            cb({ status: false, message: "parentId and childId required" })
          );

        const senderRole = socket.user.role === "child" ? "child" : "parent";
        const senderId =
          socket.user.role === "child"
            ? socket.user.childId || socket.user.child
            : socket.user.userId || socket.user.userId;

        const msg = new Message({
          parentId,
          childId,
          senderId,
          senderRole,
          content: payload.content,
        });
        await msg.save();

        // Emit to parent room and child room
        const roomParent = `parent:${parentId}`;
        const roomChild = `child:${childId}`;
        io.to(roomParent).to(roomChild).emit("message", {
          id: msg._id,
          parentId,
          childId,
          senderId,
          senderRole,
          content: msg.content,
          createdAt: msg.createdAt,
        });

        cb && cb({ status: true, message: "sent", data: msg });
      } catch (err) {
        console.error("send_message error", err);
        cb && cb({ status: false, message: "Server error" });
      }
    });

    socket.on("mark_read", async (payload, cb) => {
      // payload: { messageId }
      try {
        const { messageId } = payload || {};
        if (!messageId)
          return cb && cb({ status: false, message: "messageId required" });
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { $set: { read: true } },
          { new: true }
        );
        if (!msg)
          return cb && cb({ status: false, message: "Message not found" });
        // notify other party
        io.to(`parent:${msg.parentId}`)
          .to(`child:${msg.childId}`)
          .emit("message_read", { id: msg._id });
        cb && cb({ status: true });
      } catch (err) {
        console.error("mark_read error", err);
        cb && cb({ status: false, message: "Server error" });
      }
    });

    socket.on("get_history", async (payload, cb) => {
      // payload: { parentId, childId, limit }
      try {
        const { parentId, childId, limit = 50 } = payload || {};
        if (!parentId || !childId)
          return (
            cb &&
            cb({ status: false, message: "parentId and childId required" })
          );
        const messages = await Message.find({ parentId, childId })
          .sort({ createdAt: -1 })
          .limit(Math.min(200, limit));
        cb && cb({ status: true, data: messages.reverse() });
      } catch (err) {
        console.error("get_history error", err);
        cb && cb({ status: false, message: "Server error" });
      }
    });

    socket.on("disconnect", () => {
      // noop for now
    });
  });

  return io;
}

module.exports = { initSocket };
