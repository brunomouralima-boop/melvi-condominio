export type MemberKind = "PERSON" | "JOINT";
export type AccountType = "CHECKING" | "SAVINGS" | "CASH" | "INVESTMENT" | "WALLET";
export type CategoryKind = "INCOME" | "EXPENSE";
export type TxType = "INCOME" | "EXPENSE" | "TRANSFER";
export type AssetType = "PROPERTY" | "VEHICLE" | "INVESTMENT" | "OTHER";
export type LiabilityType = "MORTGAGE" | "LOAN" | "CREDIT" | "OTHER";

export interface Member {
  id: string;
  name: string;
  kind: MemberKind;
  color: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  rateToBase: number;
}

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  currencyCode: string;
  currency: Currency;
  memberId: string;
  member: Member;
  openingBalance: number;
  archived: boolean;
  balance: number;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  parentId: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  type: TxType;
  amount: number;
  currencyCode: string;
  currency: Currency;
  accountId: string;
  account: Account;
  toAccountId: string | null;
  toAccount: Account | null;
  toAmount: number | null;
  toCurrencyCode: string | null;
  categoryId: string | null;
  category: Category | null;
  memberId: string;
  member: Member;
  description: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  memberId: string;
  member: Member;
  currencyCode: string;
  currency: Currency;
  value: number;
  acquisitionValue: number | null;
  acquisitionDate: string | null;
  notes: string;
  liabilities: Liability[];
}

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  memberId: string;
  member: Member;
  currencyCode: string;
  currency: Currency;
  outstandingBalance: number;
  originalAmount: number | null;
  linkedAssetId: string | null;
  linkedAsset: { id: string; name: string } | null;
  notes: string;
}

export interface NetWorthMember {
  member: Member;
  liquidAssets: number;
  otherAssets: number;
  totalAssets: number;
  liabilities: number;
  netWorth: number;
}

export interface NetWorth {
  baseCurrency: string;
  perMember: NetWorthMember[];
  totals: Omit<NetWorthMember, "member">;
}

export interface Cashflow {
  baseCurrency: string;
  from: string;
  to: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  expenseByCategory: { categoryId: string; name: string; color: string; total: number }[];
  perMember: { member: Member; income: number; expense: number; net: number }[];
}

export interface MonthlySeries {
  baseCurrency: string;
  series: { month: string; income: number; expense: number; net: number }[];
}
