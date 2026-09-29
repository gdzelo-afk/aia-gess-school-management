export const fixtureId = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
export const demoAccounts = [
  {
    id: 'demo-director',
    email: 'director@demo.aia.local',
    name: 'თამარ ჯაფარიძე',
    role: 'director',
    person: 1,
  },
  {
    id: 'demo-teacher',
    email: 'teacher@demo.aia.local',
    name: 'მარიამ კაპანაძე',
    role: 'teacher',
    person: 2,
  },
  {
    id: 'demo-parent',
    email: 'parent@demo.aia.local',
    name: 'ნინო მაისურაძე',
    role: 'guardian',
    person: 3,
  },
  {
    id: 'demo-student',
    email: 'student@demo.aia.local',
    name: 'ელენე მაისურაძე',
    role: 'student',
    person: 100,
  },
] as const;
export const demoPassword = 'AiaDemo-2026!';
export const fictionalNames = [
  'ელენე მაისურაძე',
  'ანდრია მაისურაძე',
  'ლუკა აბაშიძე',
  'ბარბარე ბერიძე',
  'ნიკოლოზ გელაშვილი',
  'ანა ლომიძე',
  'დავით კიკნაძე',
  'მარიამ ჩხეიძე',
  'სანდრო მელაძე',
  'სალომე კვარაცხელია',
  'თეკლა დვალი',
  'გიორგი ონიანი',
];
