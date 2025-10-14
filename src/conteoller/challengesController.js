const path = require('path');

exports.getChallenges = (req, res) => {
  try {
    const challengesPath = path.join(__dirname, '..', '..', 'challenges.json');
    const challenges = require(challengesPath);
    return res.json({status:"true", challenges});
  } catch (err) {
    console.error('getChallenges error', err);
    return res.status(500).json({status: "false", message: 'Server error' });
  }
};
