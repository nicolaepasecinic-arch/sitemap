/* Sitemap file-attachment helpers (pure). */
export const ATTACH_ACCEPT = '.jpg,.jpeg,.png,.svg,.bmp,.gif,.pdf,.psd,.ai,.eps,.tiff,.tif,.rtf,.txt,.docx,.doc,.pages,.odt,.pptx,.ppt,.odp,.key,.xlsx,.xls,.csv,.mp4,.mov,.webm,.xml,.json,.zip';
export const fileToDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
export const isImageAtt = (f) => /^image\//.test(f.type || '') || /\.(jpe?g|png|gif|svg|bmp|webp)$/i.test(f.name || '');
export const prettySize = (n) => { if (!n) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; };
