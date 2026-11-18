import type { Classificacao, Estabelecimento } from "@/lib/types";

const ASSUNTO = "Fiscalização em lixo fora do horário de coleta";

function ou(value: string, fallback: string): string {
  const text = value.trim();
  return text || fallback;
}

function natureza(item: Estabelecimento): string {
  const cnae = item.cnae.trim();
  if (item.segmento === "comercio") {
    const base =
      "Comércio de gêneros alimentícios (mercado, mercearia, sacolão ou supermercado). Pela atividade, gera resíduos de embalagens, orgânicos e rejeitos em volume potencialmente superior ao de um pequeno gerador.";
    return cnae ? `${base} ${cnae}.` : base;
  }
  const base =
    "Estabelecimento de alimentação (lanchonete, hamburgueria, pastelaria, açaiteria ou serviço similar). Pela atividade, gera resíduos orgânicos, embalagens, rejeitos e recicláveis.";
  return cnae ? `${base} ${cnae}.` : base;
}

function perfil(item: Estabelecimento): string {
  if (item.segmento === "comercio") {
    return "comércio de alimentos de circulação de público e reposição contínua de mercadorias";
  }
  return "estabelecimento de alimentação de circulação de público";
}

export function assuntoSugerido(): string {
  return ASSUNTO;
}

export function gerarMinuta(item: Estabelecimento, classificacao: Classificacao, observacao: string): string {
  const regiao = ou(item.regiao, "região administrativa do Distrito Federal");
  const obs = observacao.trim();
  const blocoObs = obs
    ? `\n\n5. ELEMENTO ESPECÍFICO DESTE PONTO\n${obs}`
    : "";

  return `1. DADOS DO ESTABELECIMENTO DENUNCIADO

Razão Social: ${ou(item.razaoSocial, "[preencher razão social]")}
Nome Fantasia: ${ou(item.nome, "[preencher nome fantasia]")}
CNPJ: ${ou(item.cnpj, "[preencher CNPJ]")}
Endereço: ${ou(item.endereco, "[preencher endereço]")} | CEP: ${ou(item.cep, "[preencher CEP]")}
Ramo de Atividade / Natureza: ${natureza(item)}

2. FATOS E IRREGULARIDADES A APURAR

O empreendimento acima qualificado funciona como ${perfil(item)}, em ${regiao}. Pela natureza e pela dimensão usual da atividade, há geração de resíduos sólidos indiferenciados, materiais recicláveis e, no caso de alimentação, fração orgânica.

Solicita-se a apuração das desconformidades abaixo, no mesmo enquadramento do protocolo de referência sobre fiscalização de lixo fora do horário de coleta. Até esta manifestação, não foi apresentada comprovação em contrário:

- Apresentação de lixo fora do horário e das condições de coleta: resíduos acondicionados ou dispostos sem observância das normas de segregação na origem, contentores e horários de apresentação para a coleta.

- Ausência ou desatualização de PGRS Digital: não há comprovação, junto a esta manifestação, de Plano de Gerenciamento de Resíduos Sólidos atualizado e homologado na plataforma eletrônica distrital (app.pgrsdigital.com.br), em desacordo com as exigências legais em vigor.

- Normas de grande gerador: em razão da escala operacional desse tipo de estabelecimento, o volume diário de resíduos sólidos indiferenciados pode exceder o limite legal de 120 litros/dia, sem comprovação de cadastro ativo no SGI/SLU e de contratação regular de empresa autorizada para a coleta e o transporte privados.

- Risco sanitário e falta de rastreabilidade (MTR/CDF): omissão na emissão e no arquivamento dos Manifestos de Transporte de Resíduos (MTR, via SINIR ou sistema equivalente) e dos respectivos Certificados de Destinação Final (CDF), sem prova de destinação ambientalmente adequada. A falta de separação e de controle aumenta o risco de mistura indevida de fluxos e de acúmulo de resíduos em via ou área comum.

3. FUNDAMENTAÇÃO LEGAL

- Decreto Distrital nº 46.520/2024 (institui o PGRS Digital e a obrigatoriedade de atualização).
- Lei Distrital nº 5.610/2016 e Decreto Distrital nº 37.568/2016 (obrigações e responsabilidade dos grandes geradores de resíduos no DF).
- Instrução Normativa SLU nº 89/2016 (segregação na origem, acondicionamento, contentores e apresentação para coleta).
- Lei Federal nº 12.305/2010 — Política Nacional de Resíduos Sólidos (arts. 20, 21 e 22).

4. PEDIDOS

Solicita-se a este órgão fiscalizador (DF Legal / SUFIR):

- Vistoria técnica no local para verificação da infraestrutura de armazenamento interno e temporário e das rotinas de separação e de apresentação dos resíduos para coleta, inclusive quanto ao horário.
- Notificação do responsável pelo estabelecimento para exibição do protocolo ativo e aprovado do PGRS Digital, da Anotação de Responsabilidade Técnica (ART/CREA), quando exigível, dos contratos com empresas de coleta privada credenciadas no SLU e dos manifestos de destinação final (MTR/CDF).
- Aplicação das sanções administrativas e multas cabíveis, nos termos da legislação distrital vigente, caso a vistoria constate as irregularidades.

Classificação pretendida: ${classificacao}.
Assunto: ${ASSUNTO}.${blocoObs}`.trim();
}
