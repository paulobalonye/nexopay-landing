// Runs at startup on Railway — writes env vars into config.js for the browser
const fs = require('fs');

const config = `window.AIRTABLE_KEY = '${process.env.AIRTABLE_KEY || ''}';
window.AIRTABLE_BASE = '${process.env.AIRTABLE_BASE || ''}';
window.AIRTABLE_TABLE_ID = '${process.env.AIRTABLE_TABLE_ID || ''}';
`;

fs.writeFileSync('./config.js', config);
console.log('✅ config.js generated from environment variables');
