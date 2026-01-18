/* formsender.js v2.0 - Robust & Async Compatible */
window.FormSender = {
    // Fungsi utama pengirim WA (Bisa dipanggil manual)
    send: function(form) {
        // 1. Cari Link WA di halaman
        const whatsappLinks = Array.from(
            document.querySelectorAll('a[href*="klik."], a[href*="link."], a[href*="whatsapp."], a[href*="what."]')
        ).filter(link => !link.href.includes('📞') && !decodeURIComponent(link.href).includes('📞'));
        
        const whatsappLink = whatsappLinks.find(link => link.href);
        if (!whatsappLink) {
            console.warn('FormSender: Link WhatsApp tidak ditemukan.');
            return;
        }

        // 2. Info Halaman (Source)
        let message = `*Form Pendaftaran Online*\n`;
        message += `📄 Page: ${document.title}\n`;
        message += `🔗 URL: ${window.location.href}\n`;
        message += `---------------------------\n\n`;

        // 3. Collect Data (Lebih Pintar Cari Label)
        const formElements = form.querySelectorAll('input, select, textarea');
        
        formElements.forEach(element => {
            // Skip hidden, button, atau element yang tidak terlihat
            if (element.type === 'hidden' || element.type === 'submit' || element.style.display === 'none' || element.offsetParent === null) {
                return;
            }
            // Skip country code (karena cuma pelengkap no hp)
            if (element.classList.contains('country-select')) return;

            let label = '';
            let value = element.value.trim();
            
            // Logika Pencarian Label Berjenjang
            // A. Cek atribut 'name' khusus (WPForms compatibility)
            if (element.classList.contains('wpforms-field-name-first')) label = 'Nama Depan';
            
            // B. Cek Label "For" standard
            if (!label && element.id) {
                const labelEl = form.querySelector(`label[for="${element.id}"]`);
                if (labelEl) label = labelEl.innerText.replace('*', '').trim();
            }

            // C. Cek Parent Wrapper (Untuk struktur Custom Grid / Bootstrap)
            // Mencari label di dalam div pembungkus terdekat
            if (!label) {
                const parent = element.closest('.form-group-row, .mb-3, .form-group, .input-group');
                if (parent) {
                    // Cari label di dalam row yang sama, tapi bukan label radio/checkbox wrapper
                    const foundLabel = parent.parentElement.querySelector('label.form-label') || parent.querySelector('label:not(.form-check-label)');
                    if (foundLabel) label = foundLabel.innerText.replace('*', '').trim();
                }
            }

            // D. Fallback ke Placeholder
            if (!label) label = element.placeholder || element.name;

            // E. Formatting Value Khusus
            if (value) {
                // Tambah satuan otomatis
                if (label.toLowerCase().includes('tinggi') && !value.toLowerCase().includes('cm')) value += ' cm';
                if (label.toLowerCase().includes('berat') && !value.toLowerCase().includes('kg')) value += ' kg';
                
                // Khusus Checkbox (Gabungkan value)
                if(element.type === 'checkbox') {
                    if(!element.checked) return; // Skip kalau gak dicentang
                    // Logic checkbox array biasanya kompleks, disini kita ambil simplenya:
                    // Kalau checkbox, kita append nama valuenya saja
                    // (Implementasi sederhana, sesuaikan jika butuh array grouping)
                }

                // Append ke message
                // Pastikan label tidak kosong dan value tidak kosong
                if(label && value && element.type !== 'radio' && element.type !== 'checkbox') {
                    message += `*${label}:* ${value}\n`;
                }
                // Handle Radio/Checkbox terpilih
                if((element.type === 'radio' || element.type === 'checkbox') && element.checked) {
                     // Cari label spesifik radio tsb
                     const radioLabel = element.nextElementSibling || element.parentElement;
                     let valText = radioLabel ? radioLabel.innerText : value;
                     message += `*${label || element.name}:* ${valText}\n`;
                }
            }
        });

        // 4. Buka WhatsApp
        const baseUrl = whatsappLink.href.split('?')[0];
        const whatsappUrl = new URL(baseUrl);
        whatsappUrl.searchParams.set('text', message);
        window.open(whatsappUrl.toString(), '_blank');
    }
};

// Event Listener Otomatis (Hanya untuk form biasa)
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        // JANGAN jalankan otomatis jika form punya class 'async-form'
        // Karena form tersebut akan trigger WA manual setelah sukses fetch ke database
        if (form.classList.contains('async-form')) {
            return; 
        }

        form.addEventListener('submit', function(e) {
            // Validasi standar HTML5
            if (!this.checkValidity()) return;
            
            // Kirim WA langsung
            window.FormSender.send(this);
        });
    });
});