const path = require('path');

const holidaysPath = path.join(__dirname, '..', '..', 'Holidays.json');

exports.getHolidays = (req, res) => {
  try {
    const holidays = require(holidaysPath);
    return res.json({ status: true, holidays });
  } catch (err) {
    console.error('Failed to load holidays:', err);
    return res.status(500).json({ status: false, error: 'Failed to load holidays' });
  }
};
