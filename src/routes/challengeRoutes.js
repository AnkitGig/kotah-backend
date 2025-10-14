const express = require('express');
const router = express.Router();
const { getChallenges } = require('../conteoller/challengesController');

// GET / -> list challenges
router.get('/', getChallenges);

module.exports = router;
