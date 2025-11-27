import jsPDF from 'jspdf';

interface PatientData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  blood_type: string;
  gender: string;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact?: string;
  medications?: any[];
}

interface DoctorData {
  name: string;
  id: string;
}

export const generatePatientClinicalSummaryPDF = (
  patient: PatientData,
  doctorData?: DoctorData
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Set default font
  doc.setFont('helvetica');
  
  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Patient Clinical Summary', 20, 20);

  let yPosition = 35;
  const pageWidth = doc.internal.pageSize.getWidth();
  const lineHeight = 6;
  const leftMargin = 20;
  const contentWidth = pageWidth - 40;

  // Helper function to add section heading
  const addSectionHeading = (heading: string) => {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(heading, leftMargin, yPosition);
    yPosition += 8;
  };

  // Helper function to add content line
  const addContentLine = (label: string, value: string) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Check if we need to add a new page
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    const labelWidth = 50;
    const valueWidth = contentWidth - labelWidth;

    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', leftMargin, yPosition);
    
    doc.setFont('helvetica', 'normal');
    const splitValue = doc.splitTextToSize(value, valueWidth);
    doc.text(splitValue, leftMargin + labelWidth + 5, yPosition);
    
    yPosition += lineHeight * splitValue.length + 2;
  };

  // Patient Demographics Section
  addSectionHeading('Patient Demographics');
  addContentLine('Patient Name', patient.full_name);
  addContentLine('Patient ID', patient.id);
  addContentLine('Primary Phone', patient.phone || 'N/A');
  addContentLine('Email', patient.email);
  addContentLine('Gender', patient.gender || 'N/A');
  addContentLine('Date of Birth', patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A');

  yPosition += 3;

  // Medical Information Section
  addSectionHeading('Medical Information');
  addContentLine('Blood Type', patient.blood_type || 'N/A');
  
  const allergiesStr = patient.allergies && patient.allergies.length > 0 
    ? patient.allergies.join(', ') 
    : 'None';
  addContentLine('Allergies', allergiesStr);
  
  const conditionsStr = patient.chronic_conditions && patient.chronic_conditions.length > 0 
    ? patient.chronic_conditions.join(', ') 
    : 'None';
  addContentLine('Chronic Conditions', conditionsStr);
  
  addContentLine('Emergency Contact', patient.emergency_contact || 'N/A');

  yPosition += 3;

  // Active Medications Section
  if (patient.medications && patient.medications.length > 0) {
    addSectionHeading('Active Medications');
    patient.medications.forEach((med: any, index: number) => {
      const medicationText = `${index + 1}. ${med.name || 'Unknown'} — ${med.dosage || 'N/A'} • ${med.frequency || 'N/A'}`;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      const splitMed = doc.splitTextToSize(medicationText, contentWidth);
      doc.text(splitMed, leftMargin, yPosition);
      yPosition += lineHeight * splitMed.length + 2;
      
      if (med.notes) {
        doc.setFont('helvetica', 'italic');
        const noteText = `Notes: ${med.notes}`;
        const splitNote = doc.splitTextToSize(noteText, contentWidth - 5);
        doc.text(splitNote, leftMargin + 5, yPosition);
        yPosition += lineHeight * splitNote.length + 2;
      }
    });
  }

  yPosition += 5;

  // Footer with generation info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generated on ${new Date().toLocaleString()}`, leftMargin, yPosition);
  
  if (doctorData?.name) {
    yPosition += 5;
    doc.text(`Prepared by Dr. ${doctorData.name}`, leftMargin, yPosition);
  }

  // Save the PDF
  const fileName = `${patient.full_name}_Clinical_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
