import { describe, expect, it } from "vitest";
import { quotes, required, suggest, type SuggestionInput } from "@/lib/suggestion";
import { readPatterns } from "@/lib/betPatterns";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

/** O cartão de amanhã, com os números que a fonte deu mesmo. */
function input(over: Partial<SuggestionInput> = {}): SuggestionInput {
  return {
    markets: [
      { mercado: "Casa", probabilidade_pct: 57.1 },
      { mercado: "1X", probabilidade_pct: 82.3 },
      { mercado: "Menos de 3.5 Golos", probabilidade_pct: 67.2 },
    ],
    amostraPct: 80,
    prices: { Casa: 1.9, "Menos de 3.5 Golos": 1.9 },
    implied: { Casa: 52.0, "1X": 82.1, "Menos de 3.5 Golos": 57.9 },
    record: new Map(),
    adjustments: {},
    ...over,
  };
}

function record(over: Partial<AccuracyMarket> = {}): AccuracyMarket {
  return {
    market: "Casa",
    grupo: "Resultado",
    samples: 120,
    predicted_pct: 57,
    actual_pct: 45,
    gap_pp: -12,
    brier: 0.2,
    ...over,
  };
}

describe("quotes", () => {
  it("põe lado a lado o nosso número, o do mercado e o preço", () => {
    const linha = quotes(input()).find((q) => q.market === "Casa")!;

    expect(linha.marketPct).toBe(52);
    expect(linha.price).toBe(1.9);
    expect(linha.gap).toBeCloseTo(linha.ours - 52, 5);
  });

  it("dá preço justo mesmo onde as casas não cotam", () => {
    // O 1X não vem nas odds (só h2h e totais), mas o justo calcula-se.
    const linha = quotes(input()).find((q) => q.market === "1X")!;

    expect(linha.price).toBeNull();
    expect(linha.edge).toBeNull();
    expect(linha.fairPrice).toBeGreaterThan(1);
  });

  it("usa o ajuste medido do mercado quando ele existe", () => {
    const sem = quotes(input()).find((q) => q.market === "1X")!;
    const com = quotes(
      input({ adjustments: { "1X": -10.5 } }),
    ).find((q) => q.market === "1X")!;

    expect(com.ours).toBeCloseTo(82.3 - 10.5, 1);
    expect(com.ours).not.toBeCloseTo(sem.ours, 1);
  });
});

describe("required", () => {
  it("não pede nada de especial a quem tem histórico", () => {
    expect(required(80)).toBeCloseTo(3, 5);
    expect(required(70)).toBeCloseTo(3, 5);
  });

  it("sobe a fasquia à medida que o histórico encurta", () => {
    expect(required(50)).toBeCloseTo(5, 5);
    expect(required(33)).toBeCloseTo(6.7, 5);
  });

  it("pára de subir, que a partir de certa altura já não diz nada", () => {
    expect(required(10)).toBeCloseTo(9, 5);
    expect(required(0)).toBeCloseTo(9, 5);
  });
});

describe("suggest", () => {
  it("escolhe o mercado que mais paga acima do que vale", () => {
    const got = suggest(input());

    expect(got.call).toBe("apostar");
    expect(got.pick?.market).toBe("Menos de 3.5 Golos");
    // O preço está em cima, em letra grande; a frase não o repete.
    expect(got.pick?.price).toBe(1.9);
    expect(got.because).toContain("estão a pagar mais do que isso");
  });

  it("dá uma opinião quando o histórico é curto, em vez de calar", () => {
    // É o caso de todos os oito jogos de um sábado: amostra entre 17% e
    // 42%. Antes isto travava o jogo inteiro e saía o mesmo cartão em
    // todos eles.
    const got = suggest(input({ amostraPct: 33 }));

    expect(got.pick).not.toBeNull();
    expect(got.call).toBe("pequena");
    // Uma instrução no fim, e não um adjectivo.
    expect(got.because).toContain("aposta menos do que o costume");
    // E o porquê em campo próprio, dito como quem fala.
    expect(got.raised.map((r) => r.what)).toEqual([
      "só temos 33% dos jogos passados que queríamos",
    ]);
  });

  it("é o histórico, e só ele, que separa a aposta da aposta pequena", () => {
    // Seis pontos de vantagem: chegam de sobra com histórico cheio e
    // ficam a dois da fasquia quando ele é curto. Mesmo jogo, mesma
    // conta, resposta diferente — que é o que a amostra devia fazer.
    const jogo = {
      markets: [{ mercado: "Casa", probabilidade_pct: 67 }],
      prices: { Casa: 2.0 },
      implied: { Casa: 50 },
    };

    const cheio = suggest(input({ ...jogo, amostraPct: 80 }));
    const curto = suggest(input({ ...jogo, amostraPct: 20 }));

    expect(cheio.call).toBe("apostar");
    expect(curto.call).toBe("pequena");
    expect(curto.required).toBeCloseTo(8, 5);
    expect(curto.pick?.market).toBe("Casa");
  });

  it("não chama aposta a um azarão que paga um ponto acima do justo", () => {
    // Abaixo dos 55% a probabilidade não leva desconto, por isso um
    // ponto de vantagem ali é o ruído da medição. Sem este chão, um
    // "Vitória Fora a 4,20" ganhava a um 1X seguro.
    const got = suggest(
      input({
        markets: [
          { mercado: "Fora", probabilidade_pct: 25 },
          { mercado: "Menos de 3.5 Golos", probabilidade_pct: 61 },
        ],
        prices: { Fora: 4.2, "Menos de 3.5 Golos": 1.6 },
        implied: { Fora: 23.8, "Menos de 3.5 Golos": 62.5 },
      }),
    );

    expect(got.call).toBe("passar");
    // O mais seguro dos dois, não o menos mau ao preço.
    expect(got.pick?.market).toBe("Menos de 3.5 Golos");
    expect(got.because).toContain("menos do que vale");
  });

  it("põe de parte o mercado em que estamos muito acima das casas", () => {
    const got = suggest(
      input({
        markets: [
          { mercado: "Casa", probabilidade_pct: 75 },
          { mercado: "Menos de 3.5 Golos", probabilidade_pct: 61 },
        ],
        prices: { Casa: 2.0, "Menos de 3.5 Golos": 1.6 },
        implied: { Casa: 50, "Menos de 3.5 Golos": 61 },
      }),
    );

    expect(got.pick?.market).not.toBe("Casa");
    expect(got.avoid?.market).toBe("Casa");
  });

  it("põe de parte o mercado onde o nosso registo é mau, por bom que o preço esteja", () => {
    const got = suggest(
      input({
        markets: [
          { mercado: "Casa", probabilidade_pct: 60 },
          { mercado: "Menos de 3.5 Golos", probabilidade_pct: 61 },
        ],
        prices: { Casa: 2.5, "Menos de 3.5 Golos": 1.6 },
        implied: { Casa: 55, "Menos de 3.5 Golos": 61 },
        record: new Map([["Casa", record()]]),
      }),
    );

    expect(got.pick?.market).not.toBe("Casa");
  });

  it("diz que não há nada quando todos os mercados estão desqualificados", () => {
    const got = suggest(
      input({
        markets: [{ mercado: "Casa", probabilidade_pct: 75 }],
        prices: { Casa: 2.0 },
        implied: { Casa: 50 },
      }),
    );

    expect(got.call).toBe("passar");
    expect(got.pick).toBeNull();
    expect(got.because).toContain("mais optimistas do que as casas");
  });

  it("espera quando as casas ainda não abriram, mas já diz onde vai olhar", () => {
    const got = suggest(input({ prices: null, implied: null }));

    expect(got.call).toBe("esperar");
    expect(got.pick?.market).toBe("1X");
    expect(got.because).toContain("ainda não abriram");
    expect(got.because).toContain("só vale a pena acima de");
  });

  it("separa pagar o que vale de pagar menos do que vale", () => {
    // Ambos são "não punha", e dizer que o preço come a vantagem a uma
    // odd que está em cima do justo era dizer uma coisa falsa.
    const certo = suggest(
      input({
        markets: [{ mercado: "Casa", probabilidade_pct: 52 }],
        prices: { Casa: 1.93 },
        implied: { Casa: 51 },
      }),
    );
    const barato = suggest(
      input({
        markets: [{ mercado: "Casa", probabilidade_pct: 52 }],
        prices: { Casa: 1.6 },
        implied: { Casa: 60 },
      }),
    );

    expect(certo.call).toBe("passar");
    expect(certo.because).toContain("pagam exactamente o que isto vale");
    expect(barato.because).toContain("menos do que vale");
  });

  it("não cala o aviso quando a aposta sugerida é a própria armadilha", () => {
    // Oito pontos nomeiam uma armadilha e doze desqualificam o mercado.
    // No meio há folga, e era exactamente aí que o aviso desaparecia
    // por o mercado evitado ser o mesmo que o escolhido.
    const got = suggest(
      input({
        markets: [{ mercado: "Mais de 2.5 Golos", probabilidade_pct: 65 }],
        prices: { "Mais de 2.5 Golos": 2.06 },
        implied: { "Mais de 2.5 Golos": 45.9 },
      }),
    );

    expect(got.pick?.market).toBe("Mais de 2.5 Golos");
    expect(got.avoid).toBeNull();
    expect(got.because).toContain("mais optimistas do que as casas");
  });

  it("marca o preço que ninguém cotou", () => {
    const got = suggest(
      input({
        markets: [{ mercado: "1X", probabilidade_pct: 82.3 }],
        prices: { "1X": 1.16 },
        implied: { "1X": 82.7 },
        derived: ["1X"],
      }),
    );

    expect(got.pick?.derived).toBe(true);
  });

  it("nomeia a armadilha: o mercado onde mais discordamos das casas", () => {
    const got = suggest(
      input({
        markets: [
          { mercado: "Casa", probabilidade_pct: 57.1 },
          { mercado: "Menos de 3.5 Golos", probabilidade_pct: 72 },
        ],
        prices: { Casa: 1.9, "Menos de 3.5 Golos": 1.75 },
        implied: { Casa: 52, "Menos de 3.5 Golos": 48 },
      }),
    );

    expect(got.avoid?.market).toBe("Menos de 3.5 Golos");
    expect(got.avoidBecause).toContain("quem costuma ter razão são elas");
  });

  it("não aponta como armadilha a aposta que acabou de sugerir", () => {
    const got = suggest(
      input({
        markets: [{ mercado: "Menos de 3.5 Golos", probabilidade_pct: 67.2 }],
        prices: { "Menos de 3.5 Golos": 1.9 },
        implied: { "Menos de 3.5 Golos": 47 },
      }),
    );

    expect(got.pick?.market).toBe("Menos de 3.5 Golos");
    expect(got.avoid).toBeNull();
  });

  it("avisa da armadilha mesmo num jogo de histórico curto", () => {
    // A discordância conta-se sobre os 53,5% que defendemos depois do
    // desconto, não sobre os 64,5% em bruto.
    const got = suggest(
      input({
        amostraPct: 33,
        markets: [
          { mercado: "Menos de 3.5 Golos", probabilidade_pct: 64.5 },
          { mercado: "Casa", probabilidade_pct: 52 },
        ],
        prices: { "Menos de 3.5 Golos": 1.75, Casa: 1.95 },
        implied: { "Menos de 3.5 Golos": 42, Casa: 51 },
      }),
    );

    expect(got.avoid?.market).toBe("Menos de 3.5 Golos");
    expect(got.pick?.market).toBe("Casa");
  });
});

describe("o juízo por cima do modelo", () => {
  /** Um jogo que, só pelo modelo e pelo preço, seria aposta. */
  const bom = {
    markets: [{ mercado: "Casa", probabilidade_pct: 67 }],
    prices: { Casa: 2.0 },
    implied: { Casa: 50 },
    amostraPct: 80,
  };

  const falta = (quantos: number) =>
    Array.from({ length: quantos }, (_, i) => ({
      name: `Jogador ${i}`,
      status: "out",
    }));

  it("pede mais a uma equipa desfalcada, que o modelo não sabe que está", () => {
    // O modelo conta golos de uma época inteira. Não sabe que faltam
    // quatro hoje, e a equipa que ele mediu não é a que vai jogar.
    const inteiro = suggest(input(bom));
    const desfalcado = suggest(
      input({
        ...bom,
        teams: { home: "Alavés", away: "Málaga" },
        absences: { Alavés: falta(4), Málaga: [] },
      }),
    );

    expect(inteiro.call).toBe("apostar");
    expect(desfalcado.required).toBeGreaterThan(inteiro.required);
    // As baixas contam para a fasquia e são ditas na frase, à cabeça.
    // Repeti-las na linha da exigência era dizer o mesmo duas vezes no
    // mesmo cartão, por isso saem de lá.
    expect(desfalcado.because).toContain("O Alavés leva 4 jogadores de fora");
    expect(desfalcado.raised.map((r) => r.key)).not.toContain("baixas");
  });

  it("não conta como falta quem está em dúvida", () => {
    const got = suggest(
      input({
        ...bom,
        teams: { home: "Alavés", away: "Málaga" },
        absences: {
          Alavés: [
            { name: "A", status: "doubtful" },
            { name: "B", status: "doubtful" },
            { name: "C", status: "doubtful" },
          ],
          Málaga: [],
        },
      }),
    );

    expect(got.required).toBeCloseTo(3, 5);
  });

  it("tira o resultado de questão quando as fontes trocam casa e fora", () => {
    // Jogar em casa vale golos, e a previsão deu essa vantagem a
    // alguém. Se foi ao errado, o 1X e o 2X estão trocados — e um
    // mercado trocado não é menos certo, é outro mercado.
    const got = suggest(
      input({
        markets: [
          { mercado: "1X", probabilidade_pct: 82 },
          { mercado: "Mais de 2.5 Golos", probabilidade_pct: 67 },
        ],
        prices: { "1X": 1.5, "Mais de 2.5 Golos": 2.0 },
        implied: { "1X": 70, "Mais de 2.5 Golos": 50 },
        homeAwayDisagrees: true,
      }),
    );

    // Os golos aguentam: quantos se marcam não muda por se trocarem
    // os lados.
    expect(got.pick?.market).toBe("Mais de 2.5 Golos");
  });

  it("diz que não há nada quando só havia mercados de resultado", () => {
    const got = suggest(
      input({
        markets: [{ mercado: "1X", probabilidade_pct: 82 }],
        prices: { "1X": 1.5 },
        implied: { "1X": 70 },
        homeAwayDisagrees: true,
      }),
    );

    expect(got.pick).toBeNull();
    expect(got.because).toContain("qual é a equipa da casa");
  });

  it("pede mais onde o nosso próprio dinheiro já se perdeu", () => {
    const perdedor = readPatterns([
      ...Array.from({ length: 10 }, () => ({
        market: "Menos de 3.5 Golos",
        odds: 1.3,
        won: true,
      })),
      ...Array.from({ length: 6 }, () => ({
        market: "Menos de 3.5 Golos",
        odds: 1.3,
        won: false,
      })),
    ]);

    const got = suggest(
      input({
        markets: [{ mercado: "Menos de 3.5 Golos", probabilidade_pct: 67 }],
        prices: { "Menos de 3.5 Golos": 2.0 },
        implied: { "Menos de 3.5 Golos": 50 },
        patterns: perdedor,
      }),
    );

    expect(got.required).toBeCloseTo(4.5, 5);
    expect(got.raised.map((r) => r.what)).toContain(
      "já perdemos dinheiro em apostas destas",
    );
  });

  it("o juízo só pode subir a fasquia, nunca baixá-la", () => {
    // É esta regra que torna seguro usar um número que não está
    // medido: enganar-me para cima custa uma aposta que não se fez.
    const chao = suggest(input({ ...bom, amostraPct: 100 })).required;

    expect(chao).toBeCloseTo(3, 5);
    expect(
      suggest(
        input({
          ...bom,
          amostraPct: 100,
          teams: { home: "A", away: "B" },
          absences: { A: falta(5), B: falta(5) },
        }),
      ).required,
    ).toBeGreaterThan(chao);
  });
});
