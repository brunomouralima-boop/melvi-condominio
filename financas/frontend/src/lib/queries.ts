import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Account, Asset, Category, Currency, Liability, Member } from "./types";

export const useMembers = () =>
  useQuery({ queryKey: ["members"], queryFn: async () => (await api.get<Member[]>("/members")).data });

export const useCurrencies = () =>
  useQuery({ queryKey: ["currencies"], queryFn: async () => (await api.get<Currency[]>("/currencies")).data });

export const useAccounts = () =>
  useQuery({ queryKey: ["accounts"], queryFn: async () => (await api.get<Account[]>("/accounts")).data });

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get<Category[]>("/categories")).data });

export const useAssets = () =>
  useQuery({ queryKey: ["assets"], queryFn: async () => (await api.get<Asset[]>("/assets")).data });

export const useLiabilities = () =>
  useQuery({ queryKey: ["liabilities"], queryFn: async () => (await api.get<Liability[]>("/liabilities")).data });

export const memberName = (members: Member[] | undefined, id: string) =>
  members?.find((m) => m.id === id)?.name ?? "—";
