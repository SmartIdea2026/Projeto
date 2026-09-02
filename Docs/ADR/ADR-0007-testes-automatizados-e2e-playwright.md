# **ADR 0007: Adoção do Playwright para Testes Automatizados End-to-End**

**Status:** Aceito **Data:** 02/09/2026

## **Contexto/Problema**

O AncorAI é uma aplicação desktop construída em Electron, com renderer em React/TypeScript e camada main em Node.js/TypeScript. Os testes unitários já são cobertos por Vitest, mas essa camada não valida o comportamento integrado da aplicação — abertura da janela, comunicação IPC entre main e renderer, fluxo de busca completo e interações reais de interface. É necessário adotar uma ferramenta de testes automatizados end-to-end (E2E) capaz de automatizar e validar esses fluxos em uma aplicação Electron real, e não apenas em páginas web tradicionais.

## **Decisão Tomada**

Utilizaremos o **Playwright** como ferramenta de teste end-to-end do projeto.

## **Justificativa**

* **Suporte nativo a Electron:** o Playwright oferece um módulo dedicado (`_electron`) que permite lançar a aplicação Electron real, obter as janelas do processo main e interagir com o renderer sem camadas intermediárias de compatibilidade.  
* **Menor atrito de configuração e manutenção:** dispensa o gerenciamento manual de driver de navegador (como o `chromedriver`) casado à versão específica do Chromium empacotada pelo Electron, reduzindo quebras de ambiente a cada atualização de dependência.  
* **Auto-waiting e estabilidade:** possui espera automática por elementos prontos e interagíveis, o que reduz a flakiness comum em testes E2E de interfaces assíncronas como a tela de busca do AncorAI (indicadores de carregamento, atualização em segundo plano da lista de recentes).  
* **Aderência ao stack existente:** integra-se naturalmente ao TypeScript já usado no projeto, com tipagem de primeira classe e API única para orquestrar cenários.  
* **Ferramental de diagnóstico:** conta com trace viewer, geração automática de seletores (codegen) e captura de screenshots/vídeos em falha, o que facilita a depuração dos fluxos descritos na especificação (busca, filtros, ordenação, abertura de documento).

## **Alternativas Consideradas**

* **WebdriverIO:** possui suporte a Electron via serviço de terceiros (`wdio-electron-service`), porém com maturidade e documentação inferiores às do Playwright para esse cenário específico, exigindo configuração adicional e maior superfície de manutenção.  
* **Selenium:** exige gerenciamento manual do `chromedriver` compatível com a versão do Chromium embutida no Electron, o que é frágil a cada atualização de versão. Além disso, não oferece auto-waiting nativo no mesmo nível, aumentando o risco de testes instáveis.

## **Consequências**

* **Positivas:** testes E2E mais estáveis e de configuração mais simples; melhor experiência de depuração; menor custo de manutenção ao atualizar o Electron.  
* **Negativas:** A equipe precisa adquirir familiaridade com a API e as convenções específicas do Playwright para Electron, ainda pouco usadas no time até então.  
* **Riscos:** o suporte do Playwright a Electron é tratado pela própria documentação como uma área em evolução; mudanças de API em versões futuras podem exigir ajustes nos testes (mitigado fixando a versão da dependência e acompanhando o changelog antes de atualizações).

## **Referências**

* Especificação do Sistema e Fluxo — AncorAI (`EspecificacaoSistemaAncorAI.md`)  
* ADR-0001 — Adoção do Electron como plataforma desktop

