import { beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_SLIP,
  isPriced,
  readSlip,
  slipOdds,
  withLeg,
  withOdds,
  withPlan,
  withStake,
  withoutLeg,
  writeSlip,
  type DraftSlip,
} from "@/lib/draftSlip";

const jogo = (fixtureId: number, market = "Casa") => ({
  fixtureId,
  homeTeam: "FC Porto",
  awayTeam: "Rio Ave",
  league: "Liga Portugal",
  market,
  modelProb: 71,
  kickoff: "2026-10-20T19:00:00Z",
  odds: "",
});

const com = (...ids: number[]): DraftSlip =>
  ids.reduce((slip, id) => withLeg(slip, "p1", jogo(id)), EMPTY_SLIP);

beforeEach(() => localStorage.clear());

describe("pôr um jogo no boletim", () => {
  it("o primeiro jogo diz de que desafio é o boletim", () => {
    const slip = withLeg(EMPTY_SLIP, "p1", jogo(1));

    expect(slip.planId).toBe("p1");
    expect(slip.legs).toHaveLength(1);
  });

  it("não deixa o mesmo jogo entrar duas vezes", () => {
    // Duas pernas do mesmo jogo no mesmo boletim não é uma aposta que
    // exista. É a mesma regra da lista de inserir jogos, e tem de ser
    // aplicada outra vez porque o jogo pode chegar de outro sítio.
    const slip = withLeg(com(1), "p1", jogo(1, "Mais de 2.5"));

    expect(slip.legs).toHaveLength(1);
    expect(slip.legs[0].market).toBe("Casa");
  });

  it("deixa o desafio onde está quando já há boletim", () => {
    // O segundo jogo não muda de dono: quem manda é o primeiro, e mudar
    // de desafio é uma decisão que se toma no boletim, não por acidente.
    const slip = withLeg(com(1), "p2", jogo(2));

    expect(slip.planId).toBe("p1");
    expect(slip.legs).toHaveLength(2);
  });
});

describe("tirar um jogo do boletim", () => {
  it("deixa os outros onde estão", () => {
    const slip = withoutLeg(com(1, 2, 3), "f2");

    expect(slip.legs.map((leg) => leg.fixtureId)).toEqual([1, 3]);
    expect(slip.planId).toBe("p1");
  });

  it("tirar o último apaga o boletim inteiro", () => {
    // Sem jogos não há boletim. Se o desafio e o valor escrito ficassem
    // para trás, o boletim seguinte começava com as sobras deste.
    const cheio = withStake(com(1), "12,50");
    const slip = withoutLeg(cheio, "f1");

    expect(slip).toEqual(EMPTY_SLIP);
  });
});

describe("mudar de desafio a meio", () => {
  it("mantém os jogos e volta a pedir o valor do nível", () => {
    // Os jogos são os jogos. De quem é a aposta é outra decisão, e mudá-la
    // não tem nada que apagar o trabalho de os escolher — mas o valor é do
    // nível, e o nível mudou.
    const slip = withPlan(withStake(com(1, 2), "7,50"), "p2");

    expect(slip.planId).toBe("p2");
    expect(slip.legs).toHaveLength(2);
    expect(slip.stake).toBeNull();
  });
});

describe("a odd do boletim", () => {
  it("é as pernas multiplicadas", () => {
    const slip = withOdds(withOdds(com(1, 2), "f1", "1,85"), "f2", "2,00");

    expect(slipOdds(slip)).toBe(3.7);
    expect(isPriced(slip)).toBe(true);
  });

  it("é zero enquanto faltar um preço", () => {
    // Uma odd combinada a meio de ser escrita é pior do que nenhuma:
    // parece um número e é metade de um.
    const slip = withOdds(com(1, 2), "f1", "1,85");

    expect(slipOdds(slip)).toBe(0);
    expect(isPriced(slip)).toBe(false);
  });

  it("não conta um preço que ainda não é um preço", () => {
    const slip = withOdds(withOdds(com(1, 2), "f1", "1,"), "f2", "2");

    expect(slipOdds(slip)).toBe(0);
  });
});

describe("o boletim guardado no telemóvel", () => {
  it("volta igual depois de recarregar a página", () => {
    const slip = withOdds(com(1, 2), "f1", "1,85");
    writeSlip(slip);

    expect(readSlip()).toEqual(slip);
  });

  it("apaga-se quando fica sem jogos", () => {
    writeSlip(com(1));
    writeSlip(EMPTY_SLIP);

    expect(readSlip()).toEqual(EMPTY_SLIP);
  });

  it("começa vazio perante lixo, em vez de rebentar", () => {
    // Uma versão antiga da aplicação, ou alguém a mexer no armazenamento.
    localStorage.setItem("scorelab_draft_slip", "{isto não é json");

    expect(readSlip()).toEqual(EMPTY_SLIP);
  });

  it("deita fora a perna a que falta o essencial", () => {
    localStorage.setItem(
      "scorelab_draft_slip",
      JSON.stringify({
        planId: "p1",
        legs: [jogo(1), { homeTeam: "Sem jogo", market: "Casa" }],
        stake: null,
      }),
    );

    expect(readSlip().legs.map((leg) => leg.fixtureId)).toEqual([1]);
  });
});
