const express = require('express');
const app = express();
const PORT = 4000;

app.get('/', (req, res) => {
    res.json({
        message: 'Simple test server is working!',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log(`Visit: http://localhost:${PORT}`);
});
