# KoçSenkron

**Tarık Hoca Canlı.xlsx** sınıf listeleriyle **koçluk tüm liste.xlsx** (Sayfa2) randevularını senkronlar.

- Saat / link kolonları korunur
- Canlıda olmayan öğrenciler satırdan temizlenir
- Yeni öğrenciler önce aynı sınıfın boş satırına yerleşir
- Ad-soyad eşlemesi Türkçe karakter farklarını tolere eder
- Dosyalar yalnızca tarayıcıda işlenir

## Çalıştırma

```bash
npm install
npm run dev
```

Tarayıcıda `http://127.0.0.1:5173` açılır.

## Gerçek dosya testi

```bash
npx tsx scripts/test-matkeys.ts
```
