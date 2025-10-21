const express = require('express');
const router = express.Router();
const { getChallenges, createChallenge } = require('../conteoller/challengesController');
const { uploadSingle } = require('../middleware/multer');

// GET / -> list challenges
router.get('/', getChallenges);
// POST / -> create a challenge
router.post('/', uploadSingle('image'), createChallenge);

module.exports = router;
