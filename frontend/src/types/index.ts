export type Role = "ADMIN" | "RESIDENT" | "DOORMAN";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  avatar?: string | null;
  fractionId?: string | null;
  fraction?: Fraction | null;
}

export interface Condominium {
  id: string;
  name: string;
  address: string;
  taxId?: string | null;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  isActive: boolean;
  settings?: any;
  towers?: Tower[];
  _count?: { towers: number; fractions: number };
}

export interface Tower {
  id: string;
  name: string;
  floors: number;
  description?: string | null;
  isActive: boolean;
  condominiumId: string;
  condominium?: { id: string; name: string };
  fractions?: Fraction[];
  stats?: { total: number; occupied: number; vacant: number };
}

export type FractionType = "APARTMENT" | "COMMERCIAL" | "GARAGE" | "STORAGE" | "OTHER";
export type FractionStatus = "OCCUPIED" | "VACANT" | "UNDER_RENOVATION" | "BLOCKED";

export interface Fraction {
  id: string;
  identifier: string;
  floor: number;
  type: FractionType;
  status: FractionStatus;
  isActive: boolean;
  permillage: string | number;
  areaM2: string | number;
  privateAreaM2?: string | number | null;
  commonAreaM2?: string | number | null;
  grossAreaM2?: string | number | null;
  bedroomsCount?: number;
  bathroomsCount?: number;
  parkingSpots?: number;
  hasBalcony?: boolean;
  hasSuite?: boolean;
  hasStorageRoom?: boolean;
  orientation?: string | null;
  description?: string | null;
  observations?: string | null;
  ownerId?: string | null;
  owner?: { id: string; name: string; email: string; avatar?: string | null; phone?: string | null } | null;
  tenantId?: string | null;
  tenant?: { id: string; name: string; email: string; avatar?: string | null; phone?: string | null } | null;
  towerId: string;
  tower?: Tower;
  residents?: AuthUser[];
}

export type OccurrenceCategory = "NOISE" | "MAINTENANCE" | "SECURITY" | "CLEANING" | "OTHER";
export type OccurrenceStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type OccurrencePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Occurrence {
  id: string;
  title: string;
  category: OccurrenceCategory;
  description: string;
  photos: string[];
  status: OccurrenceStatus;
  priority: OccurrencePriority;
  fractionId: string;
  fraction?: Fraction;
  createdById: string;
  createdBy?: { id: string; name: string };
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string } | null;
  response?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VisitStatus = "SCHEDULED" | "WAITING" | "INSIDE" | "EXITED" | "CANCELLED";

export interface Visit {
  id: string;
  guestName: string;
  guestDocument?: string | null;
  status: VisitStatus;
  entryAt?: string | null;
  exitAt?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
  fractionId: string;
  fraction?: { id: string; identifier: string; floor: number; tower?: { id: string; name: string } } | null;
  qrCodeId?: string | null;
  qrCode?: { id: string; type: string; shortCode?: string | null } | null;
  authorizedById?: string | null;
  authorizedBy?: { id: string; name: string; role?: string } | null;
  exitRegisteredById?: string | null;
  exitRegisteredBy?: { id: string; name: string; role?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type QRAccessType = "VISITOR" | "SERVICE_PROVIDER" | "EMPLOYEE";

export interface QRAccessCode {
  id: string;
  type: QRAccessType;
  guestName: string;
  guestDocument?: string | null;
  guestCompany?: string | null;
  serviceType?: string | null;
  photo?: string | null;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  qrCodeData: string;
  shortCode?: string | null;
  fractionId: string;
  fraction?: Fraction;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  _count?: { accessLogs: number };
}

export type PanicStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";

export interface PanicAlert {
  id: string;
  description: string;
  fractionId: string;
  fraction?: Fraction;
  triggeredById: string;
  triggeredBy?: { id: string; name: string; phone?: string | null };
  status: PanicStatus;
  acknowledgedById?: string | null;
  acknowledgedBy?: { id: string; name: string } | null;
  acknowledgedAt?: string | null;
  createdAt: string;
}

export interface PanicAlertPayload {
  id: string;
  unit: string; // legado: "TorreNome IdentificadorFraccao"
  fractionId: string;
  residentName: string;
  residentPhone?: string | null;
  description: string;
  timestamp: string;
  status: PanicStatus;
}

export interface AccessLog {
  id: string;
  type: "ENTRY" | "EXIT";
  personName: string;
  personDocument?: string | null;
  fractionId?: string | null;
  fraction?: Fraction | null;
  qrCodeId?: string | null;
  method: "QR" | "MANUAL";
  registeredById: string;
  registeredBy?: { id: string; name: string };
  notes?: string | null;
  timestamp: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "INFO" | "WARNING" | "URGENT";
  attachments: string[];
  isPinned: boolean;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  relatedId?: string | null;
  createdAt: string;
}

export interface AdminStats {
  units: number; // legacy
  fractions: number;
  residents: number;
  openOccurrences: number;
  activePanic: number;
  todayAccess: number;
  byCategory: { category: string; count: number }[];
  accessByDay: { date: string; count: number }[];
}

// ─────────── Medidores ───────────
export type MeterType = "WATER" | "ELECTRICITY" | "GENERATOR" | "FUEL";
export type MaintenanceStatus = "OK" | "WARNING" | "OVERDUE";

export interface GeneratorConfig {
  id: string;
  meterId: string;
  maintenanceIntervalHours: string | number;
  lastMaintenanceHours: string | number;
  lastMaintenanceDate?: string | null;
  notes?: string | null;
}

export interface MeterReadingSummary {
  value: number;
  date: string;
  month: number;
  year: number;
  consumption: number | null;
}

export interface GeneratorDerived {
  nextMaintenanceHours: number;
  hoursUntilMaintenance: number;
  maintenanceStatus: MaintenanceStatus;
}

export interface Meter {
  id: string;
  name: string;
  type: MeterType;
  serialNumber?: string | null;
  location?: string | null;
  unit: string;
  capacity?: string | number | null;
  isActive: boolean;
  condominiumId: string;
  towerId?: string | null;
  tower?: { id: string; name: string } | null;
  generatorConfig?: GeneratorConfig | null;
  lastReading?: MeterReadingSummary | null;
  generator?: GeneratorDerived | null;
}

export interface MeterReading {
  id: string;
  meterId: string;
  readingValue: string | number;
  previousValue?: string | number | null;
  consumption?: string | number | null;
  readingDate: string;
  readingMonth: number;
  readingYear: number;
  photo?: string | null;
  notes?: string | null;
  isReset: boolean;
  registeredBy?: { id: string; name: string };
  createdAt: string;
}

// ─────────── Manutenção ───────────
export type MaintKind = "CORRECTIVE" | "PREVENTIVE";
export type MaintStatus = "OPEN" | "SCHEDULED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type MaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type MaintFrequency = "NONE" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";

export interface Supplier {
  id: string;
  name: string;
  category?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  notes?: string | null;
  isActive: boolean;
  _count?: { orders: number };
  createdAt: string;
}

export interface MaintenanceOrder {
  id: string;
  title: string;
  description?: string | null;
  kind: MaintKind;
  status: MaintStatus;
  priority: MaintPriority;
  category?: string | null;
  cost?: string | number | null;
  frequency: MaintFrequency;
  scheduledDate?: string | null;
  nextDueDate?: string | null;
  completedDate?: string | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string; phone?: string | null } | null;
  towerId?: string | null;
  tower?: { id: string; name: string } | null;
  fractionId?: string | null;
  fraction?: { id: string; identifier: string } | null;
  createdAt: string;
}

export interface MaintenanceStats {
  open: number;
  inProgress: number;
  scheduled: number;
  doneMonth: number;
  preventiveDue: number;
}

// ─────────── Assembleias ───────────
export type AssemblyType = "ORDINARY" | "EXTRAORDINARY";
export type AssemblyStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "CLOSED" | "CANCELLED";
export type AgendaItemStatus = "PENDING" | "VOTING_OPEN" | "VOTING_CLOSED" | "APPROVED" | "REJECTED";
export type VoteChoice = "FOR" | "AGAINST" | "ABSTAIN";

export interface AssemblyListItem {
  id: string;
  title: string;
  type: AssemblyType;
  status: AssemblyStatus;
  scheduledAt: string;
  location?: string | null;
  _count?: { agendaItems: number };
}

export interface AgendaTally {
  forWeight: number;
  againstWeight: number;
  abstainWeight: number;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  totalWeight: number;
  totalCount: number;
}

export interface AgendaItemFull {
  id: string;
  order: number;
  title: string;
  description?: string | null;
  status: AgendaItemStatus;
  requiresVote: boolean;
  tally: AgendaTally;
  myVotes: { fractionId: string; choice: VoteChoice }[];
}

export interface MyFraction {
  id: string;
  identifier: string;
  tower?: string | null;
  permillage: number;
}

export interface AssemblyDetail {
  id: string;
  title: string;
  type: AssemblyType;
  status: AssemblyStatus;
  scheduledAt: string;
  location?: string | null;
  description?: string | null;
  quorumPermillage?: number | null;
  createdBy?: { id: string; name: string };
  agendaItems: AgendaItemFull[];
  myFractions: MyFraction[];
  totalPermillage: number;
}

// ─────────── Documentos ───────────
export type DocumentCategory = "MINUTES" | "REGULATION" | "CONTRACT" | "FINANCIAL" | "CIRCULAR" | "OTHER";

export interface DocumentItem {
  id: string;
  title: string;
  description?: string | null;
  category: DocumentCategory;
  fileUrl: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  visibleToResidents: boolean;
  uploadedBy?: { id: string; name: string };
  createdAt: string;
}
