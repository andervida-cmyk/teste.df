export type Conferencia = "confirmado" | "divergente" | "pendente";

export type Confianca = "confirmado" | "com_ressalva" | "candidato" | "sem_cnpj";

export type Segmento = "alimentacao" | "comercio";

export type Classificacao = "Reclamação" | "Denúncia";

export type Estabelecimento = {
  id: string;
  grupo: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cep: string;
  bairro: string;
  regiao: string;
  telefone: string;
  email: string;
  atividade: string;
  cnae: string;
  situacao: string;
  segmento: Segmento;
  conferencia: Conferencia;
  confianca: Confianca;
  enderecoLevantamento: string;
  alertas: string;
  fontes: string;
  pronto: boolean;
};

export type Override = {
  nome?: string;
  razaoSocial?: string;
  cnpj?: string;
  endereco?: string;
  cep?: string;
  atividade?: string;
  regiao?: string;
  telefone?: string;
  situacao?: string;
  cnae?: string;
  observacao?: string;
  classificacao?: Classificacao;
  minutaEditada?: string;
  minutaManual?: boolean;
  copiadoEm?: string;
};

export type CnpjCard = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacao: string;
  endereco: string;
  cep: string;
  bairro: string;
  municipio: string;
  uf: string;
  cnae: string;
  telefone: string;
};

export type LookupResult =
  | { ok: true; card: CnpjCard }
  | { ok: false; message: string };
