const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// الرابط والمفتاح مع وضع قيم افتراضية قادمة مباشر من مشروعك
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uzsxfezdglgynjsgtqdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_KEY is missing!');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// تقديم الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API للتحقق من كود الوثيقة
app.get('/api/verify-code', async (req, res) => {
  try {
    const rawCode = req.query.code;

    if (!rawCode) {
      return res.status(400).json({ status: 'invalid', message: 'Code is required' });
    }

    const cleanCode = rawCode.trim();

    // البحث عن الكود في جدول product_codes دون النظر لحالة الحروف (ilike)
    const { data: record, error } = await supabase
      .from('product_codes')
      .select('*')
      .ilike('code', cleanCode)
      .maybeSingle();

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }

    // إذا لم يتم العثور على الكود
    if (!record) {
      return res.json({ status: 'not_found' });
    }

    const currentScanCount = (record.scan_count || 0) + 1;
    const now = new Date().toISOString();

    // تحديث عدد مرات الفحص وتاريخ أول فحص
    const updateData = { scan_count: currentScanCount };
    if (!record.scanned_at) {
      updateData.scanned_at = now;
    }

    await supabase
      .from('product_codes')
      .update(updateData)
      .eq('id', record.id);

    // إذا كان الفحص للمرة الأولى
    if (currentScanCount === 1) {
      return res.json({
        status: 'authentic',
        productName: record.product_name,
        documentUrl: record.document_url,
        message: 'This document is verified and authentic.'
      });
    } else {
      // إذا تم فحص المستند سابقاً
      return res.json({
        status: 'scanned_before',
        productName: record.product_name,
        documentUrl: record.document_url,
        scanCount: currentScanCount,
        firstScanDate: record.scanned_at || now,
        message: 'This document has been verified previously.'
      });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// توجيه الصفحة الرئيسية لملف verify.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
