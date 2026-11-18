import { estabelecimentos } from "@/data/estabelecimentos";
import { estaPronto, formatCep, formatCnpj } from "@/lib/cnpj";
import type { Estabelecimento, Override } from "@/lib/types";

const FIELDS = [
  "nome",
  "razaoSocial",
  "cnpj",
  "endereco",
  "cep",
  "atividade",
  "regiao",
  "telefone",
  "situacao",
  "cnae",
] as const;

export function aplicar(base: Estabelecimento, override?: Override): Estabelecimento {
  if (!override) return { ...base, pronto: estaPronto(base) };
  const next: Estabelecimento = { ...base };
  for (const field of FIELDS) {
    const value = override[field];
    if (value !== undefined) next[field] = value;
  }
  next.cnpj = next.cnpj ? formatCnpj(next.cnpj) : "";
  next.cep = next.cep ? formatCep(next.cep) : "";
  next.pronto = estaPronto(next);
  return next;
}

export function catalogo(avulsos: Estabelecimento[]): Estabelecimento[] {
  const ids = new Set(estabelecimentos.map((item) => item.id));
  const extras = avulsos.filter((item) => !ids.has(item.id));
  return [...extras, ...estabelecimentos];
}

export function vazioAvulso(cnpj: string): Estabelecimento {
  return {
    id: `N-${cnpj.replace(/\D/g, "")}`,
    grupo: "Avulso",
    nome: "",
    razaoSocial: "",
    cnpj: formatCnpj(cnpj),
    endereco: "",
    cep: "",
    bairro: "",
    regiao: "Brasília - DF",
    telefone: "",
    email: "",
    atividade: "",
    cnae: "",
    situacao: "",
    segmento: "alimentacao",
    conferencia: "pendente",
    confianca: "candidato",
    enderecoLevantamento: "",
    alertas: "Incluído pela consulta de CNPJ. Não fazia parte do levantamento de 17/11/2026.",
    fontes: "cadastro público Minha Receita/BrasilAPI",
    pronto: false,
  };
}
