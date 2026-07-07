const fs = require('fs');

function addFormats(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  if (!code.includes('Html5QrcodeSupportedFormats')) {
    code = code.replace(
      'import { Html5Qrcode } from "html5-qrcode";',
      'import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";'
    );
  }

  code = code.replace(
    `              fps: 10,
              qrbox: { width: 250, height: 150 }`,
    `              fps: 10,
              qrbox: { width: 250, height: 150 },
              formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
              ]`
  );

  code = code.replace(
    `              fps: 10,
              qrbox: { width: 250, height: 250 }`,
    `              fps: 10,
              qrbox: { width: 250, height: 150 },
              formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
              ]`
  );

  fs.writeFileSync(filePath, code);
}

addFormats('src/components/GestaoValidade.tsx');
addFormats('src/components/ValidadeEstoque.tsx');
