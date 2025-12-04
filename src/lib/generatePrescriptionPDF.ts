// @ts-ignore - html2pdf.js doesn't have TypeScript definitions but works at runtime
import html2pdf from 'html2pdf.js';
// @ts-ignore - QRCode import uses different module structure
import * as QRCodeLib from 'qrcode';

export interface Medicine {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface PrescriptionData {
  id: string;
  doctorName: string;
  doctorLicense?: string;
  doctorSpecialization?: string;
  patientName: string;
  patientEmail: string;
  patientTemperature?: string;
  appointmentDate: string;
  medicines: Medicine[];
  generalNotes?: string;
  createdAt: string;
}

/**
 * Generate QR code data URL for prescription sharing
 */
export const generatePrescriptionQRCode = async (prescription: PrescriptionData): Promise<string> => {
  try {
    // Create a compact string representation of the prescription
    const prescriptionText = formatPrescriptionAsText(prescription);
    
    // Generate QR code as data URL with optimized settings for better scannability
    const qrCodeUrl = await QRCodeLib.toDataURL(prescriptionText, {
      errorCorrectionLevel: 'M',  // Changed from 'H' to 'M' for better compatibility
      type: 'image/png',
      quality: 0.95,
      margin: 2,  // Increased from 1 to 2 for better spacing
      width: 250,  // Increased from 200 to 250 for better clarity
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrCodeUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

/**
 * Format prescription as compact text for QR code
 */
const formatPrescriptionAsText = (prescription: PrescriptionData): string => {
  const medicinesText = prescription.medicines
    .map((med, idx) => {
      const notesPart = med.notes ? ` (${med.notes})` : '';
      return `${idx + 1}. ${med.medicine_name} ${med.dosage}, ${med.frequency}, ${med.duration}${notesPart}`;
    })
    .join('\n');

  return `PRESCRIPTION
Patient: ${prescription.patientName}
Doctor: ${prescription.doctorName}
Date: ${new Date(prescription.createdAt).toLocaleDateString()}
Medicines:
${medicinesText}
${prescription.generalNotes ? `\nInstructions: ${prescription.generalNotes}` : ''}`;
};

/**
 * Generate formatted PDF from prescription data
 */
export const generatePrescriptionPDF = async (
  prescription: PrescriptionData,
  qrCodeUrl?: string
): Promise<void> => {
  try {
    // Create HTML content for PDF
    const htmlContent = createPrescriptionHTML(prescription, qrCodeUrl);

    // Create a temporary element to hold the HTML
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    document.body.appendChild(element);

    // PDF options
    const options = {
      margin: 10,
      filename: `prescription-${prescription.patientName}-${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    // Generate and download PDF
    html2pdf().set(options).from(element).save();

    // Cleanup
    document.body.removeChild(element);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Create MCare Logo as SVG
 */
const createMCareLogo = (): string => {
  return `
    <svg width="60" height="60" viewBox="0 0 60 60" style="display: inline-block; vertical-align: middle;">
      <!-- Background Circle -->
      <circle cx="30" cy="30" r="28" fill="#1976d2" opacity="0.1"/>
      <!-- Heart Shape -->
      <path d="M30 50 C15 38, 8 28, 8 20 C8 12, 14 8, 20 8 C24 8, 27 11, 30 14 C33 11, 36 8, 40 8 C46 8, 52 12, 52 20 C52 28, 45 38, 30 50 Z" fill="#1976d2" stroke="#1976d2" stroke-width="1"/>
      <!-- Medical Cross in the middle -->
      <rect x="26" y="18" width="8" height="20" fill="white" rx="2"/>
      <rect x="18" y="26" width="24" height="8" fill="white" rx="2"/>
    </svg>
  `;
};

/**
 * Create formatted HTML for prescription
 */
const createPrescriptionHTML = (prescription: PrescriptionData, qrCodeUrl?: string): string => {
  const medicinesRows = prescription.medicines
    .map((med, idx) => {
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding: 14px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #1976d2; font-size: 13px;">${idx + 1}</td>
          <td style="padding: 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; font-size: 13px;">${med.medicine_name}</td>
          <td style="padding: 14px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${med.dosage}</td>
          <td style="padding: 14px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${med.frequency}</td>
          <td style="padding: 14px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${med.duration}</td>
          <td style="padding: 14px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">${med.notes || '-'}</td>
        </tr>
      `;
    })
    .join('');

  const createdDate = new Date(prescription.createdAt);
  const formattedDate = createdDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = createdDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const mcareLogo = createMCareLogo();

  return `
    <div style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 900px; margin: 0 auto; background-color: #ffffff;">
      <!-- Premium Header with Logo -->
      <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); padding: 25px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0; box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
          ${mcareLogo}
          <div style="text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px;">MCare</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 12px; font-weight: 500; letter-spacing: 0.5px;">MEDICAL CARE SYSTEM</p>
          </div>
        </div>
      </div>

      <!-- Prescription Title Section -->
      <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 20px; border-bottom: 3px solid #1976d2; text-align: center;">
        <h2 style="color: #1976d2; margin: 0 0 5px 0; font-size: 28px; font-weight: 700;">MEDICAL PRESCRIPTION</h2>
        <p style="color: #6b7280; margin: 0; font-size: 13px; font-weight: 500;">Authorized Medical Document</p>
      </div>

      <!-- Two Column Info Section -->
      <div style="display: flex; gap: 20px; padding: 25px 20px; margin-bottom: 0;">
        <!-- Doctor Section -->
        <div style="flex: 1;">
          <div style="background: linear-gradient(135deg, #f0f7ff 0%, #e6f2ff 100%); padding: 18px; border-radius: 8px; border-left: 5px solid #1976d2; box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 20px;">👨‍⚕️</span>
              <p style="margin: 0; font-weight: 700; color: #1976d2; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Doctor Information</p>
            </div>
            <div style="border-top: 1px solid rgba(25, 118, 210, 0.2); padding-top: 12px;">
              <p style="margin: 6px 0; font-size: 13px;"><span style="color: #6b7280; font-weight: 600;">Name:</span> <span style="color: #111827; font-weight: 600;">${prescription.doctorName ? `Dr. ${prescription.doctorName}` : 'N/A'}</span></p>
              <p style="margin: 6px 0; font-size: 13px;"><span style="color: #6b7280; font-weight: 600;">License:</span> <span style="color: #111827; font-family: 'Courier New', monospace;">${prescription.doctorLicense || 'N/A'}</span></p>
              <p style="margin: 6px 0; font-size: 13px;"><span style="color: #6b7280; font-weight: 600;">Specialization:</span> <span style="color: #111827;">${prescription.doctorSpecialization || 'General Practice'}</span></p>
            </div>
          </div>
        </div>

        <!-- Patient Section -->
        <div style="flex: 1;">
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #e6f9eb 100%); padding: 18px; border-radius: 8px; border-left: 5px solid #4caf50; box-shadow: 0 2px 8px rgba(76, 175, 80, 0.08);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 20px;">👤</span>
              <p style="margin: 0; font-weight: 700; color: #4caf50; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Patient Information</p>
            </div>
            <div style="border-top: 1px solid rgba(76, 175, 80, 0.2); padding-top: 12px;">
              <p style="margin: 6px 0; font-size: 13px;"><span style="color: #6b7280; font-weight: 600;">Name:</span> <span style="color: #111827; font-weight: 600;">${prescription.patientName}</span></p>
              <p style="margin: 6px 0; font-size: 13px;"><span style="color: #6b7280; font-weight: 600;">Email:</span> <span style="color: #111827; word-break: break-all;">${prescription.patientEmail}</span></p>
              ${prescription.patientTemperature ? `<p style="margin: 6px 0; font-size: 13px;"><span style="color: #6b7280; font-weight: 600;">Temperature:</span> <span style="color: #d97706; font-weight: 600;">${prescription.patientTemperature}°F</span></p>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Date & Time Section -->
      <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe8cc 100%); padding: 15px 20px; margin: 0 20px; border-radius: 8px; border-left: 5px solid #ff9800; box-shadow: 0 2px 8px rgba(255, 152, 0, 0.08); margin-bottom: 25px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">📅</span>
          <div>
            <p style="margin: 0 0 4px 0; font-weight: 700; color: #ff9800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</p>
            <p style="margin: 0; font-size: 13px; color: #333; font-weight: 500;">${formattedDate} | ${formattedTime}</p>
          </div>
        </div>
      </div>

      <!-- Medicines Table -->
      <div style="padding: 0 20px; margin-bottom: 25px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
          <span style="font-size: 20px;">💊</span>
          <h3 style="color: #1976d2; font-size: 16px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Prescribed Medicines</h3>
        </div>
        <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white;">
              <th style="padding: 14px; text-align: center; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; width: 5%;">#</th>
              <th style="padding: 14px; text-align: left; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Medicine Name</th>
              <th style="padding: 14px; text-align: center; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Dosage</th>
              <th style="padding: 14px; text-align: center; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Frequency</th>
              <th style="padding: 14px; text-align: center; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Duration</th>
              <th style="padding: 14px; text-align: left; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${medicinesRows}
          </tbody>
        </table>
      </div>

      <!-- General Instructions -->
      ${
        prescription.generalNotes
          ? `
        <div style="padding: 0 20px; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 18px; border-radius: 8px; border-left: 5px solid #fbbf24; box-shadow: 0 2px 8px rgba(251, 191, 36, 0.08);">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="font-size: 20px; line-height: 1.4;">📋</span>
              <div style="flex: 1;">
                <p style="margin: 0 0 8px 0; font-weight: 700; color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">General Instructions</p>
                <p style="margin: 0; font-size: 13px; color: #333; line-height: 1.6;">${prescription.generalNotes}</p>
              </div>
            </div>
          </div>
        </div>
      `
          : ''
      }

      <!-- QR Code Section -->
      ${
        qrCodeUrl
          ? `
        <div style="padding: 0 20px; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 25px; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #d1d5db;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px;">
              <span style="font-size: 20px;">📱</span>
              <div style="text-align: left;">
                <p style="margin: 0; font-weight: 700; color: #111827; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Share Prescription</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #6b7280;">Scan QR code to share details</p>
              </div>
            </div>
            <img src="${qrCodeUrl}" alt="Prescription QR Code" style="width: 180px; height: 180px; border: 4px solid #1976d2; border-radius: 12px; padding: 10px; background-color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          </div>
        </div>
      `
          : ''
      }

      <!-- Professional Footer -->
      <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); padding: 20px; margin-top: 25px; border-radius: 0 0 8px 8px; color: white; text-align: center; box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);">
        <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 12px;">This is an electronically generated prescription from MCare Medical Care System.</p>
        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px; margin-top: 10px;">
          <p style="margin: 3px 0; font-size: 11px; opacity: 0.9;">Prescription ID: <strong>${prescription.id}</strong> | Generated: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  `;
};

/**
 * Download prescription as PDF
 */
export const downloadPrescriptionPDF = async (prescription: PrescriptionData): Promise<void> => {
  try {
    // Generate QR code
    const qrCodeUrl = await generatePrescriptionQRCode(prescription);

    // Generate and download PDF
    await generatePrescriptionPDF(prescription, qrCodeUrl);

    console.log('Prescription PDF downloaded successfully');
  } catch (error) {
    console.error('Error downloading prescription PDF:', error);
    throw error;
  }
};
