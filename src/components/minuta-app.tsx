import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Building2,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { estabelecimentos } from "@/data/estabelecimentos";
import { cepValido, cnpjValido, formatCep, formatCnpj, onlyDigits } from "@/lib/cnpj";
import { assuntoSugerido, gerarMinuta } from "@/lib/minuta";
import { consultarCnpj } from "@/lib/lookup.functions";
import { aplicar, catalogo, vazioAvulso } from "@/lib/records";
import type { Classificacao, Estabelecimento, Override } from "@/lib/types";

const STORAGE_KEY = "minuta-df-v1";

type Filtro = "todas" | "prontas" | "incompletas" | "alimentacao" | "comercio" | "copiadas";

type Bucket = {
  overrides: Record<string, Override>;
  avulsos: Estabelecimento[];
};

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "prontas", label: "Prontas" },
  { id: "incompletas", label: "Incompletas" },
  { id: "alimentacao", label: "Alimentação" },
  { id: "comercio", label: "Comércio" },
  { id: "copiadas", label: "Já copiadas" },
];

function loadBucket(): Bucket {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { overrides: {}, avulsos: [] };
    const parsed = JSON.parse(raw) as Partial<Bucket>;
    return {
      overrides: parsed.overrides ?? {},
      avulsos: parsed.avulsos ?? [],
    };
  } catch {
    return { overrides: {}, avulsos: [] };
  }
}

function confiancaLabel(item: Estabelecimento): string {
  if (item.confianca === "confirmado") return "CNPJ confirmado em fonte";
  if (item.confianca === "com_ressalva") return "CNPJ com ressalva";
  if (item.confianca === "candidato") return "CNPJ candidato";
  return "Sem CNPJ seguro";
}

function faltando(item: Estabelecimento): string[] {
  const gaps: string[] = [];
  if (!item.nome.trim()) gaps.push("nome");
  if (!cnpjValido(item.cnpj)) gaps.push("CNPJ");
  if (!item.endereco.trim()) gaps.push("endereço");
  if (!cepValido(item.cep)) gaps.push("CEP");
  return gaps;
}

async function copiar(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function csvEscape(value: string): string {
  const text = value.replace(/\r?\n/g, " ");
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function MinutaApp() {
  const consultar = useServerFn(consultarCnpj);
  const [bucket, setBucket] = useState<Bucket>({ overrides: {}, avulsos: [] });
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("prontas");
  const [selectedId, setSelectedId] = useState<string>(estabelecimentos[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cnpjBusca, setCnpjBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [avisoBusca, setAvisoBusca] = useState("");
  const [avisoCopia, setAvisoCopia] = useState("");

  useEffect(() => {
    const loaded = loadBucket();
    setBucket(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  }, [bucket, hydrated]);

  const listaBase = useMemo(
    () => catalogo(bucket.avulsos).map((item) => aplicar(item, bucket.overrides[item.id])),
    [bucket],
  );

  const byId = useMemo(() => new Map(listaBase.map((item) => [item.id, item])), [listaBase]);

  const stats = useMemo(() => {
    const prontos = listaBase.filter((item) => item.pronto).length;
    const semCnpj = listaBase.filter((item) => !cnpjValido(item.cnpj)).length;
    const copiadas = listaBase.filter((item) => bucket.overrides[item.id]?.copiadoEm).length;
    return { total: listaBase.length, prontos, semCnpj, copiadas };
  }, [listaBase, bucket.overrides]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = onlyDigits(query);
    return listaBase.filter((item) => {
      const copied = Boolean(bucket.overrides[item.id]?.copiadoEm);
      if (filtro === "prontas" && !item.pronto) return false;
      if (filtro === "incompletas" && item.pronto) return false;
      if (filtro === "alimentacao" && item.segmento !== "alimentacao") return false;
      if (filtro === "comercio" && item.segmento !== "comercio") return false;
      if (filtro === "copiadas" && !copied) return false;
      if (!q) return true;
      const blob = `${item.nome} ${item.razaoSocial} ${item.endereco} ${item.id} ${item.regiao}`.toLowerCase();
      if (blob.includes(q)) return true;
      return qDigits.length >= 3 && onlyDigits(item.cnpj).includes(qDigits);
    });
  }, [listaBase, query, filtro, bucket.overrides]);

  const selected = byId.get(selectedId) ?? filtrados[0];
  const override = selected ? bucket.overrides[selected.id] : undefined;
  const classificacao: Classificacao = override?.classificacao ?? "Reclamação";
  const observacao = override?.observacao ?? "";
  const textoGerado = selected ? gerarMinuta(selected, classificacao, observacao) : "";
  const texto = override?.minutaManual && override.minutaEditada ? override.minutaEditada : textoGerado;

  function patch(id: string, partial: Override) {
    setBucket((current) => ({
      ...current,
      overrides: {
        ...current.overrides,
        [id]: { ...current.overrides[id], ...partial, minutaManual: false, minutaEditada: undefined },
      },
    }));
  }

  function escolher(id: string) {
    setSelectedId(id);
    setMobileOpen(true);
    setAvisoCopia("");
  }

  async function buscarCnpj() {
    const digits = onlyDigits(cnpjBusca);
    setAvisoBusca("");
    if (!cnpjValido(digits)) {
      setAvisoBusca("CNPJ inválido. Confira os dígitos.");
      return;
    }
    const formatted = formatCnpj(digits);
    const existente = listaBase.find((item) => onlyDigits(item.cnpj) === digits);
    if (existente) {
      escolher(existente.id);
      setAvisoBusca(`Este CNPJ já está na lista: ${existente.nome || existente.id}.`);
      return;
    }
    setBuscando(true);
    try {
      const result = await consultar({ data: { cnpj: digits } });
      if (!result.ok) {
        setAvisoBusca(result.message);
        return;
      }
      const card = result.card;
      const novo = vazioAvulso(formatted);
      novo.nome = card.nomeFantasia || card.razaoSocial;
      novo.razaoSocial = card.razaoSocial;
      novo.endereco = card.endereco;
      novo.cep = card.cep;
      novo.bairro = card.bairro;
      novo.regiao = card.municipio ? `${card.municipio} - ${card.uf}` : "Brasília - DF";
      novo.telefone = card.telefone;
      novo.situacao = card.situacao;
      novo.cnae = card.cnae;
      novo.atividade = card.cnae;
      novo.segmento = /mercado|mercearia|supermerc|atacad/i.test(`${card.nomeFantasia} ${card.cnae}`)
        ? "comercio"
        : "alimentacao";
      novo.pronto = Boolean(novo.nome && novo.cnpj && novo.endereco && novo.cep);
      setBucket((current) => ({
        ...current,
        avulsos: [novo, ...current.avulsos.filter((item) => item.id !== novo.id)],
      }));
      setFiltro("todas");
      escolher(novo.id);
      setAvisoBusca("Ficha encontrada. Revise o endereço antes de copiar a minuta.");
    } catch (error) {
      setAvisoBusca(error instanceof Error ? error.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setBuscando(false);
    }
  }

  async function preencherSelecionado() {
    if (!selected || !cnpjValido(selected.cnpj)) {
      setAvisoBusca("Informe um CNPJ válido neste ponto para puxar a ficha.");
      return;
    }
    setBuscando(true);
    setAvisoBusca("");
    try {
      const result = await consultar({ data: { cnpj: selected.cnpj } });
      if (!result.ok) {
        setAvisoBusca(result.message);
        return;
      }
      const card = result.card;
      patch(selected.id, {
        razaoSocial: card.razaoSocial || selected.razaoSocial,
        nome: selected.nome || card.nomeFantasia || card.razaoSocial,
        endereco: card.endereco || selected.endereco,
        cep: card.cep || selected.cep,
        situacao: card.situacao,
        cnae: card.cnae,
        atividade: selected.atividade || card.cnae,
        telefone: selected.telefone || card.telefone,
      });
      setAvisoBusca("Dados do cadastro público aplicados. Confira se o endereço é o do ponto.");
    } catch (error) {
      setAvisoBusca(error instanceof Error ? error.message : "Falha na consulta.");
    } finally {
      setBuscando(false);
    }
  }

  function restaurar() {
    if (!selected) return;
    setBucket((current) => {
      const next = { ...current.overrides };
      const copied = next[selected.id]?.copiadoEm;
      if (copied) next[selected.id] = { copiadoEm: copied };
      else delete next[selected.id];
      return { ...current, overrides: next };
    });
  }

  function proximaPronta() {
    const atual = filtrados.findIndex((item) => item.id === selected?.id);
    const ordem = [...filtrados.slice(atual + 1), ...filtrados.slice(0, Math.max(atual, 0))];
    const alvo = ordem.find((item) => item.pronto && !bucket.overrides[item.id]?.copiadoEm);
    if (alvo) escolher(alvo.id);
    else setAvisoCopia("Não há outra minuta pronta sem cópia neste filtro.");
  }

  async function copiarTexto(rotulo: string, value: string) {
    const ok = await copiar(value);
    if (!ok) {
      setAvisoCopia("Não foi possível copiar. Selecione o texto da minuta.");
      return;
    }
    if (selected) {
      setBucket((current) => ({
        ...current,
        overrides: {
          ...current.overrides,
          [selected.id]: { ...current.overrides[selected.id], copiadoEm: new Date().toISOString() },
        },
      }));
    }
    setAvisoCopia(`${rotulo} copiado.`);
  }

  function baixarCsv() {
    const header = ["Grupo", "Nome", "Razão social", "CNPJ", "Endereço", "CEP", "Região", "Pronto", "Copiada"];
    const lines = [header.join(";")];
    for (const item of listaBase) {
      lines.push(
        [
          item.id,
          item.nome,
          item.razaoSocial,
          item.cnpj,
          item.endereco,
          item.cep,
          item.regiao,
          item.pronto ? "sim" : "não",
          bucket.overrides[item.id]?.copiadoEm ? "sim" : "não",
        ]
          .map(csvEscape)
          .join(";"),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "levantamento-minutas.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const listaVisivel = (
    <aside className="flex min-h-0 flex-1 flex-col border-line bg-paper md:border-r">
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <label className="relative block">
          <span className="sr-only">Buscar estabelecimento</span>
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, endereço ou CNPJ"
            suppressHydrationWarning
            className="w-full rounded-card border border-line bg-bg py-2.5 pr-3 pl-9 text-sm text-ink outline-none placeholder:text-muted focus:border-pine"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={
                filtro === item.id
                  ? "rounded-full bg-pine px-3 py-1.5 text-xs font-medium text-paper"
                  : "rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {filtrados.length} nesta vista · {stats.prontos} prontas · {stats.semCnpj} sem CNPJ
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtrados.length === 0 ? (
          <p className="p-4 text-sm text-muted">Nenhum ponto neste filtro.</p>
        ) : (
          <ul>
            {filtrados.map((item) => {
              const ativo = item.id === selected?.id;
              const copied = Boolean(bucket.overrides[item.id]?.copiadoEm);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => escolher(item.id)}
                    className={
                      ativo
                        ? "flex w-full flex-col gap-1 border-b border-line bg-ok-soft px-4 py-3 text-left"
                        : "flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left hover:bg-bg"
                    }
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-ink">{item.nome || "Sem nome"}</span>
                      <span className="shrink-0 text-xs text-muted">{item.id}</span>
                    </span>
                    <span className="text-xs text-muted">{item.cnpj || "CNPJ não atribuído"}</span>
                    <span className="flex flex-wrap gap-2">
                      <Status pronto={item.pronto} />
                      {copied ? <span className="text-xs text-ok">Copiada</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );

  const detalhe = selected ? (
    <section className="min-h-0">
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="mb-1 inline-flex items-center gap-1 text-sm text-pine md:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <ArrowLeft className="size-4" />
              Lista
            </button>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{selected.id}</p>
            <h2 className="font-display text-3xl leading-tight text-ink">{selected.nome || "Novo ponto"}</h2>
            <p className="text-sm text-muted">
              {selected.segmento === "comercio" ? "Comércio de alimentos" : "Alimentação"} · {confiancaLabel(selected)}
              {selected.situacao ? ` · ${selected.situacao}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={proximaPronta}
              className="rounded-card border border-line bg-paper px-3 py-2 text-sm text-ink"
            >
              Próxima pronta
            </button>
            <button
              type="button"
              onClick={restaurar}
              className="inline-flex items-center gap-2 rounded-card border border-line bg-paper px-3 py-2 text-sm text-ink"
            >
              <RotateCcw className="size-4" />
              Restaurar base
            </button>
          </div>
        </div>

        {selected.alertas ? (
          <div className="flex gap-3 rounded-card border border-line bg-warn-soft p-4 text-sm text-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <p>{selected.alertas}</p>
          </div>
        ) : null}

        {!selected.pronto ? (
          <p className="rounded-card bg-bad-soft px-4 py-3 text-sm text-bad">
            Falta {faltando(selected).join(", ")} para a minuta ficar completa. O texto ainda pode ser copiado, com os
            campos em aberto marcados.
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <Campo label="Nome fantasia" value={selected.nome} onChange={(nome) => patch(selected.id, { nome })} />
          <Campo
            label="Razão social"
            value={selected.razaoSocial}
            onChange={(razaoSocial) => patch(selected.id, { razaoSocial })}
          />
          <Campo
            label="CNPJ"
            value={selected.cnpj}
            mono
            onChange={(cnpj) => patch(selected.id, { cnpj: formatCnpj(cnpj) })}
          />
          <Campo
            label="CEP"
            value={selected.cep}
            mono
            onChange={(cep) => patch(selected.id, { cep: formatCep(cep) })}
          />
          <div className="md:col-span-2">
            <Campo
              label="Endereço"
              value={selected.endereco}
              onChange={(endereco) => patch(selected.id, { endereco })}
            />
          </div>
          <Campo label="Região" value={selected.regiao} onChange={(regiao) => patch(selected.id, { regiao })} />
          <Campo
            label="Atividade"
            value={selected.atividade}
            onChange={(atividade) => patch(selected.id, { atividade })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={buscando}
            onClick={() => void preencherSelecionado()}
            className="inline-flex items-center gap-2 rounded-card bg-pine px-3 py-2 text-sm font-medium text-paper disabled:opacity-60"
          >
            <Building2 className="size-4" />
            {buscando ? "Consultando…" : "Puxar ficha deste CNPJ"}
          </button>
          {selected.enderecoLevantamento && selected.enderecoLevantamento !== selected.endereco ? (
            <button
              type="button"
              onClick={() => patch(selected.id, { endereco: selected.enderecoLevantamento })}
              className="rounded-card border border-line bg-paper px-3 py-2 text-sm text-ink"
            >
              Usar endereço do levantamento
            </button>
          ) : null}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">
            O que você viu neste ponto (entra na minuta)
          </span>
          <textarea
            value={observacao}
            onChange={(event) => patch(selected.id, { observacao: event.target.value })}
            rows={3}
            placeholder="Ex.: sacos na calçada após o horário da coleta, em 18/11, por volta das 21h."
            className="rounded-card border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-pine"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Classificação no Participa DF</span>
          {(["Reclamação", "Denúncia"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => patch(selected.id, { classificacao: opcao })}
              className={
                classificacao === opcao
                  ? "rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-paper"
                  : "rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink"
              }
            >
              {opcao}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-line bg-paper p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl text-ink">Minuta</h3>
              <p className="text-sm text-muted">
                Assunto: {assuntoSugerido()} · {texto.length} caracteres
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copiarTexto("Assunto", assuntoSugerido())}
                className="rounded-card border border-line px-3 py-2 text-sm text-ink"
              >
                Copiar assunto
              </button>
              <button
                type="button"
                onClick={() => void copiarTexto("Relato", texto)}
                className="inline-flex items-center gap-2 rounded-card bg-clay px-3 py-2 text-sm font-medium text-paper"
              >
                <ClipboardCopy className="size-4" />
                Copiar relato
              </button>
            </div>
          </div>
          {avisoCopia ? <p className="text-sm text-pine">{avisoCopia}</p> : null}
          <textarea
            value={texto}
            onChange={(event) =>
              setBucket((current) => ({
                ...current,
                overrides: {
                  ...current.overrides,
                  [selected.id]: {
                    ...current.overrides[selected.id],
                    minutaManual: true,
                    minutaEditada: event.target.value,
                  },
                },
              }))
            }
            rows={18}
            className="w-full rounded-card border border-line bg-bg px-3 py-3 text-sm leading-relaxed text-ink outline-none focus:border-pine"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href="https://www.participa.df.gov.br/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-pine"
            >
              Abrir Participa DF
              <ExternalLink className="size-4" />
            </a>
            <button
              type="button"
              onClick={() =>
                setBucket((current) => ({
                  ...current,
                  overrides: {
                    ...current.overrides,
                    [selected.id]: {
                      ...current.overrides[selected.id],
                      minutaManual: false,
                      minutaEditada: undefined,
                    },
                  },
                }))
              }
              className="text-sm text-muted"
            >
              Refazer texto com os dados
            </button>
          </div>
        </div>
      </div>
    </section>
  ) : (
    <section className="p-6 text-sm text-muted">Escolha um estabelecimento na lista.</section>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-bg text-ink">
      <header className="border-b border-line bg-pine text-paper">
        <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-medium tracking-widest text-ok-soft uppercase">Participa DF · resíduos</p>
              <h1 className="font-display text-4xl leading-none">Minuta DF</h1>
              <p className="mt-2 text-sm text-ok-soft">
                {stats.total} pontos do levantamento. {stats.prontos} já têm nome, CNPJ, endereço e CEP. {stats.copiadas}{" "}
                minutas copiadas neste navegador.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/levantamento-organizado.xlsx"
                className="inline-flex items-center gap-2 rounded-card bg-paper px-3 py-2 text-sm font-medium text-pine"
              >
                <FileSpreadsheet className="size-4" />
                Planilha organizada
              </a>
              <button
                type="button"
                onClick={baixarCsv}
                className="inline-flex items-center gap-2 rounded-card border border-ok-soft px-3 py-2 text-sm text-paper"
              >
                <Download className="size-4" />
                CSV com edições
              </button>
            </div>
          </div>
          <form
            className="flex flex-col gap-2 md:flex-row md:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              void buscarCnpj();
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs text-ok-soft">Consultar um CNPJ que não está na lista</span>
              <input
                value={cnpjBusca}
                onChange={(event) => setCnpjBusca(formatCnpj(event.target.value))}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                suppressHydrationWarning
                className="rounded-card border border-pine-deep bg-pine-deep px-3 py-2.5 text-sm text-paper outline-none placeholder:text-ok-soft"
              />
            </label>
            <button
              type="submit"
              disabled={buscando}
              className="rounded-card bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60 md:mt-5"
            >
              {buscando ? "Consultando…" : "Montar minuta"}
            </button>
          </form>
          {avisoBusca ? <p className="text-sm text-paper">{avisoBusca}</p> : null}
        </div>
      </header>

      <div className="border-b border-line bg-warn-soft px-4 py-3 text-sm text-ink md:px-6">
        A minuta segue a estrutura do protocolo OUV-299598/2026, adaptada a lanchonetes e mercados. O trecho de resíduos
        de serviço de saúde daquele centro médico não entra aqui. A planilha não prova, ponto a ponto, falta de PGRS,
        contrato ou MTR — o texto pede a vistoria. Revise cada um antes de protocolar em{" "}
        <span className="font-medium">participa.df.gov.br</span>, classificação {classificacao.toLowerCase()} e assunto
        “{assuntoSugerido()}”.
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[22rem_minmax(0,1fr)]">
        <div
          className={
            mobileOpen ? "hidden min-h-0 md:flex md:flex-col" : "flex min-h-0 flex-col"
          }
        >
          {listaVisivel}
        </div>
        <div className={mobileOpen ? "min-h-0 overflow-y-auto" : "hidden min-h-0 overflow-y-auto md:block"}>
          {detalhe}
        </div>
      </div>
    </main>
  );
}

function Status({ pronto }: { pronto: boolean }) {
  if (pronto) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ok">
        <Check className="size-3.5" />
        Pronta
      </span>
    );
  }
  return <span className="text-xs text-clay">Incompleta</span>;
}

function Campo({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        suppressHydrationWarning
        className={
          mono
            ? "rounded-card border border-line bg-paper px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-pine"
            : "rounded-card border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-pine"
        }
      />
    </label>
  );
}
