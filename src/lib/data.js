// Demo facilities and medicines. Replace with Ministry of Health master lists in production.
export const FACILITIES = [
  { id: 'qmmh', name: 'Queen ’Mamohato Memorial Hospital', town: 'Maseru', type: 'hospital', staff: 6 },
  { id: 'motebang', name: 'Motebang Hospital', town: 'Hlotse', type: 'hospital', staff: 4 },
  { id: 'mafeteng', name: 'Mafeteng Hospital', town: 'Mafeteng', type: 'hospital', staff: 3 },
  { id: 'semonkong', name: 'Semonkong Health Centre', town: 'Semonkong', type: 'health_centre', staff: 2 }
]
export const MEDICINES = [
  { id: 'para', name: 'Paracetamol 500 mg', daily: 60 },
  { id: 'amox', name: 'Amoxicillin 500 mg', daily: 25 },
  { id: 'metf', name: 'Metformin 500 mg', daily: 18 },
  { id: 'aml', name: 'Amlodipine 5 mg', daily: 15 },
  { id: 'ors', name: 'Oral rehydration salts', daily: 20 },
  { id: 'salb', name: 'Salbutamol inhaler', daily: 6 },
  { id: 'cotri', name: 'Cotrimoxazole', daily: 22 },
  { id: 'tld', name: 'TLD (HIV treatment)', daily: 30 }
]
export const SERVICES = [
  { id: 'consult', name: 'General consultation' },
  { id: 'pharmacy', name: 'Pharmacy collection' },
  { id: 'chronic', name: 'Chronic care review' }
]
export const seedStock = () =>
  Object.fromEntries(FACILITIES.map((f, i) => [f.id, Object.fromEntries(
    MEDICINES.map((m, j) => [m.id, (i * 7 + j * 5) % 6 === 0 ? 0 : ((i + 2) * (j + 3) * 11) % 140 + 8])
  )]))
