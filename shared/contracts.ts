export const roleLabels = {
  super_admin: 'მთავარი ადმინისტრატორი',
  director: 'დირექტორი',
  principal: 'სასწავლო ხელმძღვანელი',
  vice_principal: 'ხელმძღვანელის მოადგილე',
  administrator: 'ადმინისტრატორი',
  teacher: 'მასწავლებელი',
  homeroom_teacher: 'დამრიგებელი',
  student: 'მოსწავლე',
  guardian: 'მშობელი',
  accountant: 'ფინანსისტი',
  hr: 'კადრების მენეჯერი',
  librarian: 'ბიბლიოთეკარი',
  nurse: 'ექთანი',
  security: 'დაცვის თანამშრომელი',
  receptionist: 'რეგისტრატორი',
  counselor: 'კონსულტანტი',
  it_admin: 'სისტემის ადმინისტრატორი',
} as const;
export type Role = keyof typeof roleLabels;
export type Capability =
  | 'school:overview'
  | 'students:school'
  | 'students:assigned'
  | 'students:children'
  | 'students:self'
  | 'finance:school'
  | 'finance:children'
  | 'access:manage'
  | 'audit:read'
  | 'academics:manage'
  | 'people:manage'
  | 'staff:manage'
  | 'access:roles';
export const roleCapabilities: Record<Role, readonly Capability[]> = {
  super_admin: [
    'school:overview',
    'students:school',
    'finance:school',
    'access:manage',
    'audit:read',
    'academics:manage',
    'people:manage',
    'staff:manage',
    'access:roles',
  ],
  director: [
    'school:overview',
    'students:school',
    'finance:school',
    'academics:manage',
    'people:manage',
    'staff:manage',
    'access:manage',
    'access:roles',
  ],
  principal: ['school:overview', 'students:school', 'academics:manage', 'people:manage'],
  vice_principal: ['school:overview', 'students:school', 'academics:manage', 'people:manage'],
  administrator: ['students:school', 'people:manage'],
  teacher: ['students:assigned'],
  homeroom_teacher: ['students:assigned'],
  student: ['students:self'],
  guardian: ['students:children', 'finance:children'],
  accountant: ['finance:school'],
  hr: ['staff:manage'],
  librarian: [],
  nurse: [],
  security: [],
  receptionist: [],
  counselor: [],
  it_admin: ['access:manage'],
};
export function capabilitiesFor(roles: Role[]): Capability[] {
  return [...new Set(roles.flatMap((role) => roleCapabilities[role] ?? []))];
}
export interface Viewer {
  id: string;
  personId: string | null;
  name: string;
  roles: Role[];
  capabilities: Capability[];
}
export interface StudentRow {
  id: string;
  name: string;
  number: string;
  section: string | null;
  status: 'active' | 'archived';
}
export interface StudentPage {
  items: StudentRow[];
  total: number;
  limit: number;
  offset: number;
}
export interface AgendaItem {
  id: string;
  time: string;
  title: string;
  detail: string;
  kind: 'lesson' | 'meeting' | 'event';
}
export interface Announcement {
  id: string;
  title: string;
  category: string;
  date: string;
  body: string;
}
export interface FoundationOverview {
  viewer: Viewer;
  demo: boolean;
  snapshotDate: string;
  schoolName: string;
  academicYear: string;
  students: StudentRow[];
  totalStudents: number;
  school: null | {
    students: number;
    sections: number;
    teachers: number;
    gradeDistribution: { grade: number; students: number }[];
  };
  agenda: AgendaItem[];
  announcements: Announcement[];
}
