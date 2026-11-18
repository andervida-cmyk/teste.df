import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { a as formatCnpj, i as formatCep, n as cnpjValido, o as onlyDigits } from "./cnpj-B_09LFoT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lookup.functions-C5TBXBMM.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var LOW = /* @__PURE__ */ new Set([
	"de",
	"da",
	"do",
	"das",
	"dos",
	"e",
	"em"
]);
function titlePt(value) {
	const text = value.replace(/\s+/g, " ").trim();
	if (!text) return "";
	return text.split(" ").map((word, index) => {
		const lower = word.toLowerCase();
		if (index > 0 && LOW.has(lower)) return lower;
		return lower.charAt(0).toUpperCase() + lower.slice(1);
	}).join(" ");
}
function formatCnae(code, description) {
	const digits = String(code ?? "").replace(/\D/g, "");
	const desc = String(description ?? "").trim();
	if (digits.length === 7) return `CNAE ${digits.slice(0, 4)}-${digits[4]}/${digits.slice(5)}: ${desc}`.trim();
	return desc;
}
function formatPhone(value) {
	const d = String(value ?? "").replace(/\D/g, "");
	if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
	if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
	return "";
}
function cardFromPayload(json, cnpj) {
	const street = titlePt(String(json.logradouro ?? ""));
	const numero = String(json.numero ?? "").trim();
	const numeroTxt = !numero || [
		"SN",
		"S/N",
		"0"
	].includes(numero.toUpperCase()) ? "s/n" : `nº ${numero}`;
	const complemento = titlePt(String(json.complemento ?? ""));
	const bairro = titlePt(String(json.bairro ?? ""));
	const municipio = titlePt(String(json.municipio ?? "Brasília"));
	const uf = String(json.uf ?? "DF").toUpperCase();
	const endereco = [
		[street, numero ? numeroTxt : ""].filter(Boolean).join(", "),
		complemento,
		bairro,
		`${municipio} - ${uf}`
	].filter(Boolean).join(", ");
	return {
		cnpj: formatCnpj(cnpj),
		razaoSocial: titlePt(String(json.razao_social ?? "")),
		nomeFantasia: titlePt(String(json.nome_fantasia ?? "")),
		situacao: String(json.descricao_situacao_cadastral ?? "").toUpperCase(),
		endereco,
		cep: formatCep(String(json.cep ?? "")),
		bairro,
		municipio,
		uf,
		cnae: formatCnae(json.cnae_fiscal, json.cnae_fiscal_descricao),
		telefone: formatPhone(json.ddd_telefone_1)
	};
}
async function fetchJson(url) {
	const response = await fetch(url, { headers: {
		Accept: "application/json",
		"User-Agent": "Mozilla/5.0 (compatible; MinutaDF/1.0)"
	} });
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(response.status === 429 ? "A consulta pública limitou o acesso. Tente de novo em instantes." : `Falha na consulta (${response.status}).`);
	return await response.json();
}
var consultarCnpj_createServerFn_handler = createServerRpc({
	id: "34498fe2d5160fbfe8db9029cb9e896142237b7fb2179a87d57662469c3ca53e",
	name: "consultarCnpj",
	filename: "src/lib/lookup.functions.ts"
}, (opts) => consultarCnpj.__executeServer(opts));
var consultarCnpj = createServerFn({ method: "POST" }).validator((input) => {
	const cnpj = onlyDigits(String(input?.cnpj ?? ""));
	if (!cnpjValido(cnpj)) throw new Error("CNPJ inválido. Confira os 14 dígitos.");
	return { cnpj };
}).handler(consultarCnpj_createServerFn_handler, async ({ data }) => {
	const urls = [`https://minhareceita.org/${data.cnpj}`, `https://brasilapi.com.br/api/cnpj/v1/${data.cnpj}`];
	let last = "Não foi possível consultar o CNPJ agora.";
	for (const url of urls) try {
		const json = await fetchJson(url);
		if (!json) return {
			ok: false,
			message: "CNPJ não encontrado na base pública."
		};
		const card = cardFromPayload(json, data.cnpj);
		if (!card.razaoSocial && !card.endereco) {
			last = "A base pública não devolveu razão social nem endereço.";
			continue;
		}
		return {
			ok: true,
			card
		};
	} catch (error) {
		last = error instanceof Error ? error.message : last;
	}
	return {
		ok: false,
		message: last
	};
});
//#endregion
export { consultarCnpj_createServerFn_handler };
