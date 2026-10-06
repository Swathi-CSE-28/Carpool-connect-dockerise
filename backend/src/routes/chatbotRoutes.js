const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { sendMessage } = require('../controllers/chatbotController');

const router = express.Router();

// Public: works for logged-out visitors on the landing page too
router.post('/message', [body('message').isString().notEmpty()], validate, sendMessage);

module.exports = router;
