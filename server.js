const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// الاتصال بقاعدة البيانات عبر متغير البيئة DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// توجيه الخادم لقراءة ملفات الواجهة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// تحويل الزائر تلقائياً لصفحة verify.html إذا فتح الرابط الرئيسي مباشرة
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// مسار فحص الرمز عبر API
app.get('/api/verify-code', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.json({ status: 'invalid' });

    try {
        const result = await pool.query('SELECT * FROM product_codes WHERE code = $1', [code]);
        
        if (result.rows.length === 0) {
            return res.json({ status: 'not_found' });
        }

        const item = result.rows[0];

        if (item.scan_count === 0) {
            await pool.query('UPDATE product_codes SET scan_count = 1, scanned_at = NOW() WHERE code = $1', [code]);
            return res.json({
                status: 'authentic',
                productName: item.product_name,
                message: 'تم التحقق من أصالة وثيقة الطالب بنجاح.'
            });
        } else {
            await pool.query('UPDATE product_codes SET scan_count = scan_count + 1 WHERE code = $1', [code]);
            return res.json({
                status: 'scanned_before',
                productName: item.product_name,
                message: `تنبيه: تم فحص وتأكيد هذه الوثيقة سابقاً (${item.scan_count}) مرة.`,
                firstScanDate: new Date(item.scanned_at).toLocaleString('en-US')
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

app.listen(port, () => console.log(`Server is running on port ${port}`));
