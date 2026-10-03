import {
  LayoutDashboard,
  UsersRound,
  BookOpen,
  CalendarDays,
  Wallet,
  ChartNoAxesCombined,
  MessageSquare,
  Settings2,
  Shapes,
  GraduationCap,
  ClipboardCheck,
} from 'lucide-react';
import type { Viewer } from '../../shared/contracts';
export function navigation(viewer: Viewer) {
  const family = viewer.roles.includes('guardian');
  const student = viewer.roles.includes('student');
  const teaching = viewer.capabilities.includes('students:assigned');
  return [
    {
      path: '/',
      label: family ? 'ჩემი ოჯახი' : student || teaching ? 'ჩემი დღე' : 'მიმოხილვა',
      icon: LayoutDashboard,
      group: 'სასკოლო სივრცე',
    },
    ...(!student && viewer.capabilities.some((c) => c.startsWith('students:'))
      ? [
          {
            path: '/students',
            label: family ? 'ჩემი შვილები' : 'მოსწავლეები',
            icon: UsersRound,
            group: 'სასკოლო სივრცე',
          },
        ]
      : []),
    {
      path: '/academics',
      label: student ? 'ჩემი სწავლა' : teaching ? 'სწავლება' : 'სასწავლო პროცესი',
      icon: BookOpen,
      group: 'სასკოლო სივრცე',
    },
    ...(viewer.capabilities.some((c) => c.startsWith('timetable:'))
      ? [
          {
            path: '/timetable',
            label: 'გაკვეთილების განრიგი',
            icon: CalendarDays,
            group: 'სასკოლო სივრცე',
          },
        ]
      : []),
    ...(viewer.capabilities.some((c) => c.startsWith('attendance:'))
      ? [{ path: '/attendance', label: 'დასწრება', icon: ClipboardCheck, group: 'სასკოლო სივრცე' }]
      : []),
    ...(viewer.capabilities.some((c) => c.startsWith('gradebook:'))
      ? [{ path: '/gradebook', label: 'ჟურნალი', icon: BookOpen, group: 'სასკოლო სივრცე' }]
      : []),
    { path: '/calendar', label: 'კალენდარი', icon: CalendarDays, group: 'სასკოლო სივრცე' },
    { path: '/messages', label: 'შეტყობინებები', icon: MessageSquare, group: 'სასკოლო სივრცე' },
    ...(viewer.capabilities.includes('people:manage')
      ? [{ path: '/guardians', label: 'მშობლები / მეურვეები', icon: UsersRound, group: 'მართვა' }]
      : []),
    ...(viewer.capabilities.includes('staff:manage')
      ? [{ path: '/staff', label: 'თანამშრომლები', icon: UsersRound, group: 'მართვა' }]
      : []),
    ...(viewer.capabilities.includes('access:manage')
      ? [{ path: '/accounts', label: 'ანგარიშები', icon: Settings2, group: 'მართვა' }]
      : []),
    ...(viewer.capabilities.some((c) => c.startsWith('finance:'))
      ? [
          {
            path: '/finance',
            label: family ? 'გადასახადები' : 'ფინანსები',
            icon: Wallet,
            group: 'მართვა',
          },
        ]
      : []),
    ...(viewer.capabilities.includes('school:overview')
      ? [{ path: '/reports', label: 'ანგარიშგება', icon: ChartNoAxesCombined, group: 'მართვა' }]
      : []),
    { path: '/community', label: 'სასკოლო ცხოვრება', icon: GraduationCap, group: 'მართვა' },
    { path: '/settings', label: 'პარამეტრები', icon: Settings2, group: 'სხვა' },
    { path: '/design', label: 'დიზაინის სისტემა', icon: Shapes, group: 'სხვა' },
  ];
}
