const canonicalizeFramework = (value) => {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!normalized) return '';
  if (normalized.includes('rbi')) return 'RBI';
  if (normalized.includes('sebi')) return 'SEBI';
  if (normalized.includes('nist')) return 'NIST';
  if (normalized.includes('iso27001') || normalized === 'iso') return 'ISO 27001';
  if (normalized.includes('cis')) return 'CIS Controls';
  if (normalized.includes('dpdp')) return 'DPDP Act';
  if (normalized.includes('pci')) return 'PCI-DSS';
  return raw;
};

const canonicalizeFrameworks = (values = []) => [...new Set(values.map(canonicalizeFramework).filter(Boolean))];

module.exports = { canonicalizeFramework, canonicalizeFrameworks };
