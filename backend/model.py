import math
import numpy as np


def calcular_kelly(prob_calculada, odd, fracao_kelly=1.0):
    if odd <= 1:
        return 0
    kelly = (odd * prob_calculada - 1) / (odd - 1)
    return max(0, kelly * fracao_kelly)


def calcular_value_bet(odd, prob_calculada):
    if odd <= 0:
        return 0
    prob_implicita = 1 / odd
    return (prob_calculada - prob_implicita) * 100


def calcular_risco(value_bet, odd, kelly_fraction):
    if value_bet > 8:
        risco = 1
    elif value_bet > 4:
        risco = 2
    elif value_bet > 2:
        risco = 3
    elif value_bet > 0:
        risco = 4
    else:
        risco = 5

    if odd > 3:
        risco = min(risco + 1, 5)

    if kelly_fraction < 0.005:
        risco = min(risco + 1, 5)

    return risco


def media_golos(golos, jogos):
    if jogos <= 0:
        return 0
    return golos / jogos


def media_ponderada(total_golos, total_jogos, recentes_golos, recentes_jogos, peso_recente=0.65):
    media_total = media_golos(total_golos, total_jogos)
    media_recente = media_golos(recentes_golos, recentes_jogos)

    if recentes_jogos == 0:
        return media_total
    if total_jogos == 0:
        return media_recente

    peso_recente_real = min(peso_recente, 0.80)
    peso_total = 1 - peso_recente_real
    return (media_recente * peso_recente_real) + (media_total * peso_total)


def poisson_prob(lmbda, k):
    return math.exp(-lmbda) * (lmbda ** k) / math.factorial(k)


def matriz_poisson(lambda_casa, lambda_fora, max_golos=10):
    matriz = np.zeros((max_golos + 1, max_golos + 1))
    for i in range(max_golos + 1):
        for j in range(max_golos + 1):
            matriz[i, j] = poisson_prob(lambda_casa, i) * poisson_prob(lambda_fora, j)
    return matriz / matriz.sum()


def prob_over_poisson(matriz, linha):
    prob = 0
    for i in range(matriz.shape[0]):
        for j in range(matriz.shape[1]):
            if i + j > linha:
                prob += matriz[i, j]
    return prob


def prob_under_poisson(matriz, linha):
    prob = 0
    for i in range(matriz.shape[0]):
        for j in range(matriz.shape[1]):
            if i + j < linha:
                prob += matriz[i, j]
    return prob


def prob_ambas_marcam_poisson(matriz):
    prob = 0
    for i in range(1, matriz.shape[0]):
        for j in range(1, matriz.shape[1]):
            prob += matriz[i, j]
    return prob


def prob_ambas_nao_marcam_poisson(matriz):
    prob = 0
    for i in range(matriz.shape[0]):
        for j in range(matriz.shape[1]):
            if i == 0 or j == 0:
                prob += matriz[i, j]
    return prob


def simulacao_monte_carlo(lambda_casa, lambda_fora, iteracoes=10000, seed=None):
    if seed is not None:
        np.random.seed(seed)

    golos_casa = np.random.poisson(lambda_casa, iteracoes)
    golos_fora = np.random.poisson(lambda_fora, iteracoes)

    total_golos = golos_casa + golos_fora

    return {
        "Mais de 2.5 Golos": float(np.mean(total_golos >= 3)),
        "Menos de 2.5 Golos": float(np.mean(total_golos <= 2)),
        "Mais de 3.5 Golos": float(np.mean(total_golos >= 4)),
        "Menos de 3.5 Golos": float(np.mean(total_golos <= 3)),
        "Ambas Marcam": float(np.mean((golos_casa >= 1) & (golos_fora >= 1))),
        "Ambas NÃO Marcam": float(np.mean((golos_casa == 0) | (golos_fora == 0))),
    }


def obter_classificacao(value_bet):
    if value_bet >= 8:
        return "Premium"
    elif value_bet >= 5:
        return "Boa"
    elif value_bet >= 3:
        return "Fraca"
    return "Sem valor"


def calcular_confianca(value_bet, total_golos_esperados, jogos_casa, jogos_fora, kelly):
    score = 0.0

    amostra_media = (jogos_casa + jogos_fora) / 2
    if amostra_media >= 12:
        score += 3.0
    elif amostra_media >= 8:
        score += 2.2
    elif amostra_media >= 5:
        score += 1.4
    else:
        score += 0.6

    if value_bet >= 8:
        score += 3.0
    elif value_bet >= 5:
        score += 2.2
    elif value_bet >= 3:
        score += 1.5
    elif value_bet > 0:
        score += 0.8

    if total_golos_esperados >= 3.1:
        score += 2.0
    elif total_golos_esperados >= 2.7:
        score += 1.4
    elif total_golos_esperados >= 2.4:
        score += 0.8
    else:
        score += 0.2

    if kelly >= 0.05:
        score += 2.0
    elif kelly >= 0.03:
        score += 1.5
    elif kelly >= 0.015:
        score += 0.8
    elif kelly > 0:
        score += 0.3

    return min(round(score, 1), 10.0)


def obter_decisao(value_bet, jogos_casa, jogos_fora, total_golos_esperados, kelly, odd=None):
    if jogos_casa < 5 or jogos_fora < 5:
        return "Não apostar"

    if value_bet < 2:
        return "Não apostar"

    if kelly < 0.008:
        return "Não apostar"

    if odd is not None and (odd < 1.4 or odd > 4.0):
        return "Não apostar"

    if value_bet >= 5 and kelly >= 0.015 and jogos_casa >= 8 and jogos_fora >= 8:
        return "Apostar"

    return "Cautela"


def analisar_jogo(data):
    media_marcados_casa = media_ponderada(
        data.golos_marcados_casa,
        data.jogos_casa,
        data.golos_marcados_casa_rec,
        data.jogos_casa_rec
    )
    media_sofridos_casa = media_ponderada(
        data.golos_sofridos_casa,
        data.jogos_casa,
        data.golos_sofridos_casa_rec,
        data.jogos_casa_rec
    )

    media_marcados_fora = media_ponderada(
        data.golos_marcados_fora,
        data.jogos_fora,
        data.golos_marcados_fora_rec,
        data.jogos_fora_rec
    )
    media_sofridos_fora = media_ponderada(
        data.golos_sofridos_fora,
        data.jogos_fora,
        data.golos_sofridos_fora_rec,
        data.jogos_fora_rec
    )

    lambda_casa = max(0.10, (media_marcados_casa + media_sofridos_fora) / 2)
    lambda_fora = max(0.10, (media_marcados_fora + media_sofridos_casa) / 2)
    total_golos_esperados = lambda_casa + lambda_fora

    matriz = matriz_poisson(lambda_casa, lambda_fora, max_golos=10)

    prob_poisson = {
        "Mais de 2.5 Golos": prob_over_poisson(matriz, 2.5),
        "Menos de 2.5 Golos": prob_under_poisson(matriz, 2.5),
        "Mais de 3.5 Golos": prob_over_poisson(matriz, 3.5),
        "Menos de 3.5 Golos": prob_under_poisson(matriz, 3.5),
        "Ambas Marcam": prob_ambas_marcam_poisson(matriz),
        "Ambas NÃO Marcam": prob_ambas_nao_marcam_poisson(matriz),
    }

    prob_mc = simulacao_monte_carlo(lambda_casa, lambda_fora, iteracoes=10000)

    odds = {
        "Mais de 2.5 Golos": data.odd_mais_25,
        "Menos de 2.5 Golos": data.odd_menos_25,
        "Mais de 3.5 Golos": data.odd_mais_35,
        "Menos de 3.5 Golos": data.odd_menos_35,
        "Ambas Marcam": data.odd_ambas_marcam,
        "Ambas NÃO Marcam": data.odd_ambas_nao_marcam,
    }

    mercados = []
    for nome, odd in odds.items():
        prob_usada = prob_mc[nome]
        value = calcular_value_bet(odd, prob_usada)
        kelly = calcular_kelly(prob_usada, odd, data.fracao_kelly)
        stake = data.banca * kelly
        risco = calcular_risco(value, odd, kelly)
        confianca = calcular_confianca(value, total_golos_esperados, data.jogos_casa, data.jogos_fora, kelly)
        classificacao = obter_classificacao(value)
        decisao = obter_decisao(value, data.jogos_casa, data.jogos_fora, total_golos_esperados, kelly, odd)

        mercados.append({
            "mercado": nome,
            "odd": round(odd, 2),
            "prob_poisson_pct": round(prob_poisson[nome] * 100, 2),
            "prob_monte_carlo_pct": round(prob_mc[nome] * 100, 2),
            "prob_usada_pct": round(prob_usada * 100, 2),
            "prob_implicita_pct": round((1 / odd) * 100, 2),
            "value_bet_pct": round(value, 2),
            "kelly_pct": round(kelly * 100, 2),
            "stake_sugerida": round(stake, 2),
            "risco": risco,
            "confianca": confianca,
            "classificacao": classificacao,
            "decisao": decisao,
        })

    return {
        "lambda_casa": round(lambda_casa, 3),
        "lambda_fora": round(lambda_fora, 3),
        "total_golos_esperados": round(total_golos_esperados, 3),
        "mercados": mercados,
    }