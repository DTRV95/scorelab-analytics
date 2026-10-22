import { describe, expect, it } from "vitest";
import {
  buildDossier,
  enumerate,
  objections,
  type DossierInput,
} from "@/lib/matchDossier";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

const form = {
  jogos_casa: 9,
  jogos_fora: 8,
  jogos_casa_rec: 5,
  jogos_fora_rec: 5,
  league_averages: { sample_matches: 180 },
};

function input(over: Partial<DossierInput> = {}): DossierInput {
  return {
    amostraLabel: "Alta",
    amostraPct: 92,
    form,
    headline: { market: "1X", pct: 74 },
    record: null,
    oddsTyped: 0,
    ...over,
  };
}

function mercado(
  odds: Record<string, number> = { "1X": 1.45, Casa: 1.90, Empate: 3.60 },
  implied: Record<string, number> = { "1X": 70, Casa: 50, Empate: 20 },
) {
  return { odds, implied };
}

function record(over: Partial<AccuracyMarket> = {}): AccuracyMarket {
  return {
    market: "1X",
    grupo: "Resultado",
    samples: 120,
    predicted_pct: 74,
    actual_pct: 62,
    gap_pp: -12,
    brier: 0.2,
    ...over,
  };
}

describe("buildDossier", () => {
  it("conta o que sabemos e o que falta", () => {
    const dossier = buildDossier(input());

    expect(dossier.total).toBe(9);
    // Histórico, forma, casa/fora e média da liga. Registo, preço do
    // mercado, baixas, notícias e a odd escrita ficam por preencher.
    expect(dossier.known).toBe(4);
  });

  it("trata o preço e as baixas como os buracos que pesam", () => {
    const dossier = buildDossier(input());

    expect(dossier.heavyMissing).toEqual([
      "o que as casas estão a pagar",
      "quem está de fora",
    ]);
  });

  it("acende o mercado quando as casas abriram o jogo", () => {
    const dossier = buildDossier(input({ market: mercado() }));
    const linha = dossier.lines.find((line) => line.key === "mercado");

    expect(linha?.value).toBe("3 mercados lidos");
    expect(dossier.heavyMissing).toEqual(["quem está de fora"]);
  });

  it("acende a linha do preço quando já há uma odd escrita", () => {
    const sem = buildDossier(input());
    const com = buildDossier(input({ oddsTyped: 2 }));

    expect(sem.lines.find((line) => line.key === "preco")?.value).toBeNull();
    expect(com.lines.find((line) => line.key === "preco")?.value).toBe(
      "2 odds escritas",
    );
    expect(com.known).toBe(sem.known + 1);
  });

  it("não dá o registo por sabido enquanto forem poucos jogos", () => {
    const poucos = buildDossier(input({ record: record({ samples: 12 }) }));
    const muitos = buildDossier(input({ record: record() }));

    expect(poucos.lines.find((line) => line.key === "registo")?.value).toBeNull();
    expect(muitos.lines.find((line) => line.key === "registo")?.value).toBe(
      "120 jogos conferidos",
    );
  });

  it("marca a forma em falta quando a época mal começou", () => {
    const dossier = buildDossier(
      input({
        form: { ...form, jogos_casa_rec: 0, jogos_fora_rec: 0 },
      }),
    );

    expect(dossier.lines.find((line) => line.key === "forma")?.value).toBeNull();
  });

  it("aguenta um jogo sem forma nenhuma carregada", () => {
    const dossier = buildDossier(input({ form: null }));

    expect(dossier.known).toBe(1);
    expect(() => objections(input({ form: null }), dossier)).not.toThrow();
  });
});

describe("objections", () => {
  it("desconta o exagero medido acima dos 55%", () => {
    const i = input();
    const contra = objections(i, buildDossier(i));
    const topo = contra.find((item) => item.key === "topo");

    expect(topo?.text).toContain("74,0%");
    expect(topo?.text).toContain("63,0%");
    expect(topo?.grave).toBe(true);
  });

  it("não inventa exagero nenhum numa probabilidade baixa", () => {
    const i = input({ headline: { market: "Casa", pct: 40 } });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "topo")).toBeUndefined();
  });

  it("não repete a odd mínima, que o veredicto já diz", () => {
    // Estava aqui como objecção. O veredicto, que ficou por cima, diz
    // exactamente isso e com mais força; repetida, ensinava a saltar a
    // secção.
    const i = input();
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "minima")).toBeUndefined();
  });

  it("avisa de histórico curto", () => {
    const i = input({ amostraLabel: "Baixa", amostraPct: 41 });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "amostra")?.grave).toBe(true);
  });

  it("traz o nosso registo para a mesa quando ele é mau", () => {
    const i = input({ record: record() });
    const contra = objections(i, buildDossier(i));
    const linha = contra.find((item) => item.key === "registo");

    expect(linha?.text).toContain("12,0 pontos a mais");
    expect(linha?.text).toContain("120 jogos");
  });

  it("cala-se sobre o registo quando ele está em linha", () => {
    const i = input({ record: record({ actual_pct: 73, gap_pp: -1 }) });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "registo")).toBeUndefined();
  });

  it("põe as graves à frente", () => {
    const i = input({
      teams: { home: "Casa", away: "Fora" },
      absences: { Casa: [{ name: "Um", status: "injured" }] },
    });
    const contra = objections(i, buildDossier(i));
    const primeiraLeve = contra.findIndex((item) => !item.grave);
    const ultimaGrave = contra.map((item) => item.grave).lastIndexOf(true);

    expect(primeiraLeve).toBeGreaterThan(-1);
    expect(ultimaGrave).toBeLessThan(primeiraLeve);
  });
});

describe("enumerate", () => {
  it("escreve uma lista como se fala", () => {
    expect(enumerate([])).toBe("");
    expect(enumerate(["lesões"])).toBe("lesões");
    expect(enumerate(["lesões", "notícias"])).toBe("lesões e notícias");
    expect(enumerate(["a", "b", "c"])).toBe("a, b e c");
  });
});

describe("o mercado como contraditório", () => {
  it("avisa quando discordamos muito do mercado", () => {
    // Nós medimos 63%; o mercado dá 48%.
    const i = input({ market: mercado({ "1X": 2.05 }, { "1X": 48 }) });
    const contra = objections(i, buildDossier(i));
    const linha = contra.find((item) => item.key === "mercado");

    expect(linha?.text).toContain("63,0%");
    expect(linha?.text).toContain("48,0%");
    expect(linha?.text).toContain("quem costuma estar errado somos nós");
    expect(linha?.grave).toBe(true);
  });

  it("diz o contrário quando é o mercado a estar mais confiante", () => {
    const i = input({ market: mercado({ "1X": 1.25 }, { "1X": 78 }) });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "mercado")?.text).toContain(
      "sabem alguma coisa",
    );
  });

  it("cala-se quando estamos de acordo com o mercado", () => {
    const i = input({ market: mercado({ "1X": 1.60 }, { "1X": 62 }) });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "mercado")).toBeUndefined();
  });
});

describe("quando as fontes discordam de quem joga em casa", () => {
  it("não arma escândalo: o preço vai pelo nome e o aviso seria ruído", () => {
    // Medido em três jogos reais, isto dispara em dois. Um aviso grave
    // que aparece em dois terços dos jogos ensina a ignorar os avisos.
    const i = input({ market: { ...mercado(), homeAwayDisagrees: true } });
    const semDiscordia = input({ market: mercado() });

    expect(objections(i, buildDossier(i)).map((o) => o.key)).toEqual(
      objections(semDiscordia, buildDossier(semDiscordia)).map((o) => o.key),
    );
  });
});

describe("as baixas", () => {
  const teams = { home: "FC Porto", away: "Gil Vicente" };

  it("distingue 'ninguém olhou' de 'estão todos bons'", () => {
    const ninguemOlhou = buildDossier(input({ teams }));
    const todosBons = buildDossier(
      input({ teams, absences: { "FC Porto": [], "Gil Vicente": [] } }),
    );

    expect(
      ninguemOlhou.lines.find((l) => l.key === "baixas")?.value,
    ).toBeNull();
    expect(todosBons.lines.find((l) => l.key === "baixas")?.value).toBe(
      "ninguém, pelo que se sabe",
    );
  });

  it("conta os dois lados numa linha só", () => {
    const dossier = buildDossier(
      input({
        teams,
        absences: {
          "FC Porto": [{ name: "Um", status: "injured" }],
          "Gil Vicente": [
            { name: "Dois", status: "suspended" },
            { name: "Três", status: "doubtful" },
          ],
        },
      }),
    );

    expect(dossier.lines.find((l) => l.key === "baixas")?.value).toBe(
      "3 jogadores de fora",
    );
    expect(dossier.heavyMissing).not.toContain("quem está de fora");
  });

  it("nomeia quem falta, por equipa", () => {
    const i = input({
      teams,
      absences: {
        "FC Porto": [
          { name: "Um", status: "" },
          { name: "Dois", status: "" },
          { name: "Três", status: "" },
        ],
        "Gil Vicente": [],
      },
    });
    const contra = objections(i, buildDossier(i));
    const linha = contra.find((item) => item.key === "baixas-FC Porto");

    expect(linha?.text).toContain("Fora no FC Porto: Um, Dois e Três");
    expect(linha?.grave).toBe(true);
    // O lado sem baixas não ganha linha nenhuma.
    expect(
      contra.find((item) => item.key === "baixas-Gil Vicente"),
    ).toBeUndefined();
  });

  it("não inventa o peso de quem falta", () => {
    const i = input({
      teams,
      absences: { "FC Porto": [{ name: "Alguém", status: "injured" }] },
    });
    const linha = objections(i, buildDossier(i)).find(
      (item) => item.key === "baixas-FC Porto",
    );

    // Nada de "pesa 30% do ataque": não temos minutos nem golos por
    // jogador, e um peso inventado era o erro que isto existe para
    // evitar.
    expect(linha?.text).toContain("O número acima não sabe disto");
    expect(linha?.text).not.toMatch(/%/);
  });

  it("corta a lista quando são muitos", () => {
    const i = input({
      teams,
      absences: {
        "FC Porto": ["A", "B", "C", "D", "E", "F"].map((name) => ({
          name,
          status: "",
        })),
      },
    });
    const linha = objections(i, buildDossier(i)).find(
      (item) => item.key === "baixas-FC Porto",
    );

    expect(linha?.text).toContain("A, B, C e D e mais 2");
  });

  it("conta as notícias sem as interpretar", () => {
    const dossier = buildDossier(
      input({
        teams,
        news: {
          "FC Porto": [{ title: "Porto prepara o jogo" }],
          "Gil Vicente": [],
        },
      }),
    );

    expect(dossier.lines.find((l) => l.key === "noticias")?.value).toBe(
      "1 notícia",
    );
  });
});

describe("as ausências e o mercado", () => {
  const teams = { home: "Chelsea", away: "Tottenham" };
  const fora = (n: number, position?: string) =>
    Array.from({ length: n }, (_, i) => ({
      name: `Jogador ${i + 1}`,
      status: "injured",
      position,
    }));

  it("diz que posições faltam, quando se sabem", () => {
    const i = input({
      teams,
      absences: {
        Chelsea: [
          { name: "A", status: "injured", position: "guarda-redes" },
          { name: "B", status: "injured", position: "defesa" },
          { name: "C", status: "injured", position: "defesa" },
        ],
      },
    });
    const linha = objections(i, buildDossier(i)).find(
      (item) => item.key === "baixas-Chelsea",
    );

    expect(linha?.text).toContain("um guarda-redes, 2 defesas");
  });

  it("não inventa posições que não vieram", () => {
    const i = input({ teams, absences: { Chelsea: fora(2) } });
    const linha = objections(i, buildDossier(i)).find(
      (item) => item.key === "baixas-Chelsea",
    );

    expect(linha?.text).not.toContain("(");
  });

  it("liga as baixas ao preço quando estamos acima do mercado", () => {
    // É esta a resposta honesta a "isto afecta a minha aposta?": as
    // casas conhecem as baixas e já as puseram no preço.
    const i = input({
      teams,
      absences: { Tottenham: fora(3) },
      market: mercado({ "1X": 2.05 }, { "1X": 48 }),
    });
    const linha = objections(i, buildDossier(i)).find(
      (item) => item.key === "baixas-Tottenham",
    );

    expect(linha?.text).toContain("As casas sabem disto e dão 48,0%");
    expect(linha?.text).toContain("nós damos 63,0% sem saber");
  });

  it("não promete o que não sabe quando não há preço", () => {
    const i = input({ teams, absences: { Tottenham: fora(3) } });
    const linha = objections(i, buildDossier(i)).find(
      (item) => item.key === "baixas-Tottenham",
    );

    expect(linha?.text).toContain("o modelo lê golos e calendário");
    expect(linha?.text).not.toContain("As casas sabem");
  });

  it("nunca diz que um ausente era titular", () => {
    // Precisaria de minutos jogados, que nenhuma fonte nossa dá.
    const i = input({
      teams,
      absences: { Chelsea: fora(3, "avançado") },
      market: mercado({ "1X": 2.05 }, { "1X": 48 }),
    });
    const linha = objections(i, buildDossier(i)).find(
      (item) => item.key === "baixas-Chelsea",
    );

    expect(linha?.text).not.toMatch(/titular|indispens|melhor jogador/i);
  });
});

describe("a ligação ao mercado nas baixas", () => {
  it("diz-se uma vez, não uma por equipa", () => {
    // Com as duas equipas desfalcadas, a mesma frase com os mesmos dois
    // números aparecia duas vezes seguidas — enchimento puro.
    const i = input({
      teams: { home: "Casa", away: "Fora" },
      absences: {
        Casa: [{ name: "Um", status: "injured" }],
        Fora: [{ name: "Dois", status: "injured" }],
      },
      market: mercado({ "1X": 2.05 }, { "1X": 48 }),
    });
    const contra = objections(i, buildDossier(i));
    const comMercado = contra.filter((item) =>
      item.text.includes("As casas sabem disto"),
    );

    expect(comMercado).toHaveLength(1);
    // E a segunda equipa continua a ter a sua linha com os nomes.
    expect(contra.find((item) => item.key === "baixas-Fora")?.text).toContain(
      "Dois",
    );
  });
});
