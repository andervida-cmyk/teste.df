//#region node_modules/.nitro/vite/services/ssr/assets/cnpj-B_09LFoT.js
function onlyDigits(value) {
	return value.replace(/\D/g, "");
}
function formatCnpj(value) {
	const d = onlyDigits(value).slice(0, 14);
	const parts = [
		d.slice(0, 2),
		d.slice(2, 5),
		d.slice(5, 8),
		d.slice(8, 12),
		d.slice(12, 14)
	];
	if (d.length <= 2) return parts[0] ?? "";
	if (d.length <= 5) return `${parts[0]}.${parts[1]}`;
	if (d.length <= 8) return `${parts[0]}.${parts[1]}.${parts[2]}`;
	if (d.length <= 12) return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}`;
	return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}-${parts[4]}`;
}
function formatCep(value) {
	const d = onlyDigits(value).slice(0, 8);
	if (d.length <= 5) return d;
	return `${d.slice(0, 5)}-${d.slice(5)}`;
}
function cnpjValido(value) {
	const d = onlyDigits(value);
	if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
	const calc = (base) => {
		const weights = base.length === 12 ? [
			5,
			4,
			3,
			2,
			9,
			8,
			7,
			6,
			5,
			4,
			3,
			2
		] : [
			6,
			5,
			4,
			3,
			2,
			9,
			8,
			7,
			6,
			5,
			4,
			3,
			2
		];
		const rest = base.split("").reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0) % 11;
		return rest < 2 ? "0" : String(11 - rest);
	};
	return calc(d.slice(0, 12)) === d[12] && calc(d.slice(0, 13)) === d[13];
}
function cepValido(value) {
	return onlyDigits(value).length === 8;
}
function estaPronto(item) {
	return Boolean(item.nome.trim() && cnpjValido(item.cnpj) && item.endereco.trim() && cepValido(item.cep));
}
//#endregion
export { formatCnpj as a, formatCep as i, cnpjValido as n, onlyDigits as o, estaPronto as r, cepValido as t };
