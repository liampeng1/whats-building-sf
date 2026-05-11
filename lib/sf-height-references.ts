export interface HeightReference {
  name: string
  height_ft: number
  category: 'human' | 'residential' | 'civic' | 'tower'
  illustration: string  // inline SVG string
  width_px: number      // intrinsic width for layout
  source: string
}

export const SF_HEIGHT_REFERENCES: HeightReference[] = [
  {
    name: 'Person',
    height_ft: 5.83,
    category: 'human',
    width_px: 8,
    source: 'Average adult height, U.S. Census 2020',
    illustration: '<svg viewBox="0 0 8 24" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="3" r="2" fill="#1c2438"/><rect x="3" y="5" width="2" height="10" fill="#1c2438"/><rect x="2" y="14" width="1.5" height="9" fill="#1c2438"/><rect x="4.5" y="14" width="1.5" height="9" fill="#1c2438"/></svg>',
  },
  {
    name: 'Typical floor',
    height_ft: 10,
    category: 'human',
    width_px: 24,
    source: 'Standard residential floor height',
    illustration: '<svg viewBox="0 0 24 20" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="24" height="20" fill="none" stroke="#1c2438" stroke-width="1.5"/><rect x="4" y="5" width="6" height="8" fill="#1c2438" opacity="0.3"/><rect x="14" y="5" width="6" height="8" fill="#1c2438" opacity="0.3"/></svg>',
  },
  {
    name: '3-story Victorian',
    height_ft: 35,
    category: 'residential',
    width_px: 22,
    source: 'Typical SF row house, SF Planning Department historic resources',
    illustration: '<svg viewBox="0 0 22 50" xmlns="http://www.w3.org/2000/svg"><polygon points="0,15 11,0 22,15 22,50 0,50" fill="#1c2438"/><rect x="3" y="20" width="4" height="6" fill="#fbf6ec"/><rect x="15" y="20" width="4" height="6" fill="#fbf6ec"/><rect x="3" y="30" width="4" height="6" fill="#fbf6ec"/><rect x="15" y="30" width="4" height="6" fill="#fbf6ec"/><rect x="9" y="40" width="4" height="10" fill="#fbf6ec"/></svg>',
  },
  {
    name: 'Painted Ladies',
    height_ft: 40,
    category: 'residential',
    width_px: 80,
    source: '710-720 Steiner Street, ~1894 construction',
    illustration: '<svg viewBox="0 0 80 56" xmlns="http://www.w3.org/2000/svg"><g fill="#1c2438"><polygon points="0,18 13,0 26,18 26,56 0,56"/><polygon points="26,18 39,0 52,18 52,56 26,56"/><polygon points="52,18 65,0 78,18 78,56 52,56"/></g><g fill="#fbf6ec"><rect x="4" y="24" width="4" height="6"/><rect x="17" y="24" width="4" height="6"/><rect x="30" y="24" width="4" height="6"/><rect x="43" y="24" width="4" height="6"/><rect x="56" y="24" width="4" height="6"/><rect x="69" y="24" width="4" height="6"/></g></svg>',
  },
  {
    name: 'Sentinel Building',
    height_ft: 102,
    category: 'civic',
    width_px: 16,
    source: 'Columbus & Kearny, 1907; CTBUH',
    illustration: '<svg viewBox="0 0 16 120" xmlns="http://www.w3.org/2000/svg"><path d="M2,120 L2,30 Q2,15 4,10 L12,10 Q14,15 14,30 L14,120 Z" fill="#1c2438"/><rect x="6" y="40" width="4" height="50" fill="#fbf6ec" opacity="0.3"/></svg>',
  },
  {
    name: 'Coit Tower',
    height_ft: 210,
    category: 'civic',
    width_px: 18,
    source: '1933, Arthur Brown Jr.; SF Recreation & Parks',
    illustration: '<svg viewBox="0 0 18 220" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="200" width="12" height="20" fill="#1c2438"/><rect x="4" y="20" width="10" height="180" fill="#1c2438"/><rect x="5" y="10" width="8" height="10" fill="#1c2438"/><rect x="6" y="0" width="6" height="10" fill="#1c2438"/></svg>',
  },
  {
    name: 'One Embarcadero Center',
    height_ft: 568,
    category: 'tower',
    width_px: 30,
    source: '1971; CTBUH',
    illustration: '<svg viewBox="0 0 30 200" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="10" width="30" height="190" fill="#1c2438"/><rect x="2" y="0" width="26" height="10" fill="#1c2438"/></svg>',
  },
  {
    name: '555 California',
    height_ft: 779,
    category: 'tower',
    width_px: 32,
    source: '1969 (Bank of America Center); CTBUH',
    illustration: '<svg viewBox="0 0 32 240" xmlns="http://www.w3.org/2000/svg"><polygon points="2,240 2,30 16,5 30,30 30,240" fill="#1c2438"/><g fill="#fbf6ec" opacity="0.15"><rect x="6" y="40" width="2" height="180"/><rect x="14" y="40" width="2" height="180"/><rect x="22" y="40" width="2" height="180"/></g></svg>',
  },
  {
    name: 'Transamerica Pyramid',
    height_ft: 853,
    category: 'tower',
    width_px: 60,
    source: '1972, William Pereira; CTBUH',
    illustration: '<svg viewBox="0 0 60 240" xmlns="http://www.w3.org/2000/svg"><polygon points="0,240 30,0 60,240" fill="#1c2438"/></svg>',
  },
  {
    name: 'Salesforce Tower',
    height_ft: 1070,
    category: 'tower',
    width_px: 28,
    source: '2018; CTBUH',
    illustration: '<svg viewBox="0 0 28 300" xmlns="http://www.w3.org/2000/svg"><path d="M4,300 L4,80 Q4,40 14,30 Q24,40 24,80 L24,300 Z" fill="#1c2438"/><line x1="14" y1="0" x2="14" y2="30" stroke="#1c2438" stroke-width="2"/></svg>',
  },
]
