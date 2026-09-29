// Fictional browser-only copies of the foundation demo identities. No server imports or API calls.
export type Direction = 'a' | 'b' | 'c';
export const directions = {
  a: {
    name: 'ორბიტა',
    subtitle: 'სივრცე გადაწყვეტილებებისთვის',
    font: 'Mersad',
    description: 'ფენები, სინათლე და მშვიდი სიზუსტე.',
  },
  b: {
    name: 'ვექტორი',
    subtitle: 'ყველაფერი ზუსტ კოორდინატზე',
    font: 'BPG DejaVu Sans + Eurostile',
    description: 'მჭიდრო რიტმი. მკაფიო სიგნალი. სრული კონტროლი.',
  },
  c: {
    name: 'იმპულსი',
    subtitle: 'სკოლა მოძრაობაში',
    font: '123 Antena + MCh NeoBau',
    description: 'თამამი ტიპოგრაფია და გააზრებული წესრიგი.',
  },
} as const;
export const sections = ['VII ა', 'VII ბ', 'VIII ა', 'IX ა'];
const names = [
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
export const people = names.map((name, i) => ({
  id: `AG-${2601 + i}`,
  name,
  section: sections[i % 4]!,
  initials: name
    .split(' ')
    .map((s) => s[0])
    .join(''),
  status: i === 4 || i === 8 ? 'გადასამოწმებელი' : 'აქტიური',
  guardian: i < 2 ? 'ნინო მაისურაძე' : 'საილუსტრაციო კავშირი',
  grades: [8 + (i % 3), 7 + (i % 4), 9, '', 8 + (i % 3)].map(String),
}));
export type Person = (typeof people)[number];
export const agenda = [
  {
    time: '09:00',
    end: '09:45',
    title: 'სასწავლო დღის დასაწყისი',
    detail: 'ყველა კლასი · პირველი გაკვეთილი',
  },
  {
    time: '11:30',
    end: '12:00',
    title: 'აკადემიური გუნდის შეხვედრა',
    detail: 'შეხვედრების ოთახი · 30 წუთი',
  },
  { time: '15:00', end: '16:00', title: 'სამეცნიერო კლუბი', detail: 'VIII–IX კლასი · ლაბორატორია' },
];
export const priorities = [
  {
    title: 'ორი პროფილი გადასამოწმებელია',
    detail: 'მოსწავლის საკონტაქტო კავშირები',
    time: 'დღეს',
    route: 'students?status=review',
    number: '02',
  },
  {
    title: 'კვირის სასწავლო მიმოხილვა',
    detail: 'ქართული ენა · შეფასების სამუშაო ხედი',
    time: '11:30',
    route: 'gradebook',
    number: '01',
  },
  {
    title: 'აკადემიური გუნდის შეხვედრა',
    detail: 'დღის განრიგი და სამუშაო პრიორიტეტები',
    time: '11:30',
    route: 'meeting',
    number: '03',
  },
];
export const fonts = [
  {
    id: 'mersad',
    name: 'Mersad',
    file: 'mersad.ttf',
    kind: 'ცვლადი გროტესკი',
    note: 'ფართო რიტმი, მკაფიო ციფრები; სამუშაო ტექსტი და დიდი სათაურები.',
    axes: 'wght 100–900',
  },
  {
    id: 'antena',
    name: '123 Antena',
    file: 'antena.ttf',
    kind: 'ცვლადი ვიწრო სასათაურე',
    note: 'გამორჩეული ვერტიკალური რიტმი. მცირე ტექსტისთვის ზედმეტად ვიწროა.',
    axes: 'wght 100–700 · ital −100–100',
  },
  {
    id: 'mecomicse',
    name: 'TF Mecomicse',
    file: 'mecomicse.otf',
    kind: 'ექსპრესიული თანამედროვე',
    note: 'ორგანული ფორმები და ძლიერი ხასიათი; მცირე ტექსტში რიტმი უფრო ხმაურიანია.',
    axes: 'სტატიკური ნიმუში',
  },
  {
    id: 'eurostile',
    name: 'Eurostile GEO_Nus',
    file: 'eurostile.ttf',
    kind: 'ტექნიკური გეომეტრიული',
    note: 'კვადრატული ფორმები და ზუსტი ციფრები. მონაცემებისა და კონტექსტის აქცენტი.',
    axes: 'სტატიკური ნიმუში',
  },
  {
    id: 'neobau',
    name: 'MCh NeoBau',
    file: 'neobau.otf',
    kind: 'გეომეტრიული სანსი',
    note: 'ღია ფორმები, ვიწრო რიტმი. ინტერფეისში 14–16 პიქსელი მეტ ჰაერს აძლევს.',
    axes: 'Regular + Bold',
  },
  {
    id: 'nino',
    name: 'BPG Nino Medium',
    file: 'nino.otf',
    kind: 'ჰუმანისტური სანსი',
    note: 'მსუბუქი, მომრგვალებული ხასიათი; მონაცემთა პატარა ნიშნები ფრთხილ შემოწმებას ითხოვს.',
    axes: 'Medium',
  },
  {
    id: 'nino-cond',
    name: 'BPG Nino Elite Cond',
    file: 'nino-cond.otf',
    kind: 'ვიწრო სანსი',
    note: 'გრძელი სახელებისთვის ეკონომიური სიგანე; 12 პიქსელზე თხელი შტრიხები.',
    axes: 'Regular',
  },
  {
    id: 'rioni',
    name: 'BPG Rioni Vera Condensed Light',
    file: 'rioni.otf',
    kind: 'ვიწრო მსუბუქი',
    note: 'დელიკატური სათაურები; მცირე ცხრილში წონა არასაკმარისია.',
    axes: 'Light',
  },
  {
    id: 'bpg-sans',
    name: 'BPG Sans',
    file: 'bpg-sans.ttf',
    kind: 'სანსერიფული ტექსტური',
    note: 'მტკიცე მცირე ტექსტი; ერთი ნიმუშის მძიმე ტონი ზღუდავს იერარქიას.',
    axes: 'Regular',
  },
  {
    id: 'dejavu',
    name: 'BPG DejaVu Sans',
    file: 'dejavu.otf',
    kind: 'ჰუმანისტური სამუშაო',
    note: 'სტაბილური ტექსტი, ქართული და ლათინური ერთ რიტმში. მჭიდრო სამუშაო გარემოსთვის.',
    axes: 'Regular',
  },
  {
    id: 'pillar',
    name: 'MS Pillar',
    file: 'pillar.otf',
    kind: 'ვერტიკალური სასათაურე',
    note: 'ძლიერი სილუეტი დიდი მასშტაბით; მცირე ზომაში სამუშაო ტექსტს ვერ ცვლის.',
    axes: 'Regular',
  },
  {
    id: 'vardi',
    name: 'MCh Ma Si Vardi Serif',
    file: 'vardi.otf',
    kind: 'თანამედროვე სასათაურე სერიფი',
    note: 'თხელი კონტრასტული ფორმები; ექსპრესიული მომენტისთვის, არა მონაცემთა ცხრილისთვის.',
    axes: 'Regular',
  },
];
