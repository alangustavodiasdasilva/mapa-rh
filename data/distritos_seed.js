// Estrutura inicial do distrito Lagoa Vermelha: microrregiões, cidade polo e cidades atendidas.
// É carregada UMA vez (mesclando com o que já existir) e depois pode ser editada à vontade no menu Distritos.
window.DISTRITOS_SEED = [
  {
    nome: "Lagoa Vermelha", uf: "RS", cor: "#16a34a",
    micros: [
      { nome: "Lagoa Vermelha", polo: "Lagoa Vermelha", cidades: ["Ibiraiaras","Lagoa Vermelha","Muliterno"] },
      { nome: "Capão Bonito do Sul", polo: "Capão Bonito do Sul", cidades: ["Capão Bonito do Sul"] },
      { nome: "David Canabarro", polo: "David Canabarro", cidades: ["Caseiros","Ciríaco","David Canabarro","Vanini"] },
      { nome: "Casca", polo: "Casca", cidades: ["Casca","Itapuca","Montauri","São Domingos do Sul","Serafina Corrêa","União da Serra"] },
      { nome: "Muitos Capões", polo: "Muitos Capões", cidades: ["Esmeralda","Muitos Capões","Pinhal da Serra"] },
      { nome: "Vacaria", polo: "Vacaria", cidades: ["Bom Jesus","Campestre da Serra","Ipê","São Francisco de Paula","São José dos Ausentes","Vacaria"] },
      { nome: "Nova Prata", polo: "Nova Prata", cidades: ["André da Rocha","Guabiju","Guaporé","Nova Araçá","Nova Prata","Protásio Alves","São Jorge","Veranópolis","Vista Alegre do Prata"] },
    ]
  }
];

// Coordenadas (IBGE) das cidades do distrito, para funcionar mesmo sem baixar a lista completa de municípios.
// Formato: [nome, UF, latitude, longitude, código IBGE]
window.CIDADES_SEED = (window.CIDADES_SEED || []).concat([
  ["Ibiraiaras","RS",-28.3741,-51.6377,"4309902"],
  ["Lagoa Vermelha","RS",-28.2093,-51.5248,"4311304"],
  ["Muliterno","RS",-28.3253,-51.7697,"4312625"],
  ["Capão Bonito do Sul","RS",-28.1254,-51.3961,"4304622"],
  ["Caseiros","RS",-28.2582,-51.6861,"4304952"],
  ["Ciríaco","RS",-28.3419,-51.8741,"4305504"],
  ["David Canabarro","RS",-28.3849,-51.8482,"4306304"],
  ["Vanini","RS",-28.4758,-51.8447,"4322558"],
  ["Casca","RS",-28.5605,-51.9815,"4304903"],
  ["Itapuca","RS",-28.7768,-52.1693,"4310579"],
  ["Montauri","RS",-28.6462,-52.0767,"4312351"],
  ["São Domingos do Sul","RS",-28.5312,-51.886,"4318051"],
  ["Serafina Corrêa","RS",-28.7126,-51.9352,"4320404"],
  ["União da Serra","RS",-28.7833,-52.0238,"4322350"],
  ["Esmeralda","RS",-28.0518,-51.1933,"4307401"],
  ["Muitos Capões","RS",-28.3132,-51.1836,"4312617"],
  ["Pinhal da Serra","RS",-27.8751,-51.1673,"4314464"],
  ["Bom Jesus","RS",-28.6697,-50.4295,"4302303"],
  ["Campestre da Serra","RS",-28.7926,-51.0941,"4303673"],
  ["Ipê","RS",-28.8171,-51.2859,"4310439"],
  ["São Francisco de Paula","RS",-29.4404,-50.5828,"4318200"],
  ["São José dos Ausentes","RS",-28.7476,-50.0677,"4318622"],
  ["Vacaria","RS",-28.5079,-50.9418,"4322509"],
  ["André da Rocha","RS",-28.6283,-51.5797,"4300661"],
  ["Guabiju","RS",-28.5421,-51.6948,"4309258"],
  ["Guaporé","RS",-28.8399,-51.8895,"4309407"],
  ["Nova Araçá","RS",-28.6537,-51.7458,"4312807"],
  ["Nova Prata","RS",-28.7799,-51.6113,"4313300"],
  ["Protásio Alves","RS",-28.7572,-51.4757,"4315172"],
  ["São Jorge","RS",-28.4984,-51.7064,"4318440"],
  ["Veranópolis","RS",-28.9312,-51.5516,"4322806"],
  ["Vista Alegre do Prata","RS",-28.8052,-51.7947,"4323606"]
]);
