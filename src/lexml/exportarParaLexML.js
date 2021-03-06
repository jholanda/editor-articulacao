/* Copyright 2017 Assembleia Legislativa de Minas Gerais
 * 
 * This file is part of Editor-Articulacao.
 *
 * Editor-Articulacao is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * Editor-Articulacao is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Editor-Articulacao.  If not, see <http://www.gnu.org/licenses/>.
 */

import ArticulacaoInvalidaException from './ArticulacaoInvalidaException';
import padrao from '../opcoesPadrao';

var htmlInline = new Set(['SPAN', 'B', 'I', 'A', 'SUB', 'SUP', 'INS', 'DEL', 'DFN']);

/**
 * Exporta para o XML definido no LexML (http://projeto.lexml.gov.br/documentacao/Parte-3-XML-Schema.pdf),
 * a partir da estrutura do HTML do editor de articulação.
 * 
 * @param {Element} dispositivoDOM Dispositivo da articulação, dentro do editor de articulação,
 * onde será iniciada a exportação para LexML, ou o próprio container (elemento raíz) do
 * editor de articulação.
 * @returns {Element} Articulação do LexML
 */
function exportarParaLexML(dispositivoDOM, rotulos) {
    var cntArtigos = 0;

    if (!rotulos) {
        rotulos = padrao.rotulo;
    }

    /**
     * Representa o contexto da transformação,
     * com informações e métodos para adição de dispositivos,
     * podendo ser especializado por tipo.
     */
    class ContextoTransformacao {
        constructor(dispositivoLexML, contextoAnterior) {
            this.dispositivoLexML = dispositivoLexML;
            this.contextoAnterior = contextoAnterior;
            this.cntSubitens = {
                get Artigo() {
                    return cntArtigos;
                },
                set Artigo(valor) {
                    cntArtigos = valor;
                }
            };
        }

        get id() {
            return this.dispositivoLexML.id;
        }

        /**
         * Obtém o identificador a ser considerado ao criar o id para
         * um subtipo deste dispositivo.
         * 
         * @param {String} subtipo Subtipo desejado.
         */
        getIdReferencia(subtipo) {
            return this.dispositivoLexML.id;
        }

        /**
         * Tipo do dispositivo.
         */
        get tipo() {
            return this.dispositivoLexML.tagName;
        }

        adicionarSubitem(dispositivoLexML) {
            this.cntSubitens[dispositivoLexML.tagName] = this.cntSubitens[dispositivoLexML.tagName] ? this.cntSubitens[dispositivoLexML.tagName] + 1 : 1;
            this.dispositivoLexML.appendChild(dispositivoLexML);
        }

        adicionarSubitemEmendado(dispositivoLexML) {
            this.dispositivoLexML.appendChild(dispositivoLexML);
        }

        adicionarProximo(dispositivoLexML) {
            this.dispositivoLexML.parentNode.appendChild(dispositivoLexML);
        }

        possuiSubtipo(subtipo) {
            switch (this.tipo) {
                case 'Articulacao':
                    return subtipo === 'Artigo' || subtipo === 'Titulo' || subtipo === 'Capitulo' || subtipo === 'Secao' || subtipo === 'Livro' || subtipo === 'Parte';

                case 'Parte':
                    return subtipo === 'Livro';

                case 'Livro':
                    return subtipo === 'Titulo';

                case 'Titulo':
                    return subtipo === 'Capitulo' || subtipo === 'Artigo';

                case 'Capitulo':
                    return subtipo === 'Secao' || subtipo === 'Artigo';

                case 'Secao':
                    return subtipo === 'Subsecao' || subtipo === 'Artigo';

                case 'Subsecao':
                    return subtipo === 'Artigo';

                case 'Artigo':
                    return subtipo === 'Inciso' || subtipo === 'Paragrafo';

                case 'Inciso':
                    return subtipo === 'Alinea';

                case 'Alinea':
                    return subtipo === 'Item';

                case 'Item':
                    return false;

                case 'Paragrafo':
                    return subtipo === 'Inciso';

                default:
                    throw 'Tipo desconhecido: ' + this.tipo;
            }
        }

        contarSubitens(subtipo) {
            return this.cntSubitens[subtipo] || 0;
        }
    }

    /**
     * Contexto de transformação especializado para artigo, que possui
     * incisos no caput e parágrafos no artigo.
     */
    class ContextoTransformacaoArtigo extends ContextoTransformacao {
        getIdReferencia(subtipo) {
            // O inciso é sobre o caput. Já o parágrafo é sobre o artigo.
            return subtipo === 'Inciso' ? this.dispositivoLexML.id + '_cpt' : this.dispositivoLexML.id;
        }

        adicionarSubitem(dispositivoLexML) {
            if (dispositivoLexML.tagName === 'p' || dispositivoLexML.tagName === 'Inciso') {
                this.dispositivoLexML.querySelector('Caput').appendChild(dispositivoLexML);
            } else {
                this.dispositivoLexML.appendChild(dispositivoLexML);
            }

            this.cntSubitens[dispositivoLexML.tagName] = this.cntSubitens[dispositivoLexML.tagName] ? this.cntSubitens[dispositivoLexML.tagName] + 1 : 1;
        }
    }

    /**
     * Contexto de transformação especializado em divisões de texto (agrupadores),
     * como título, capítulo, seção e subseção.
     */
    class ContextoTransformacaoAgrupador extends ContextoTransformacao {
        getIdReferencia(subtipo) {
            return subtipo === 'Artigo' ? null : super.getIdReferencia(subtipo);
        }
    }

    /**
     * Cria o contexto adequado conforme o tipo do nó.
     * 
     * @param {Element} dispositivoLexML 
     * @param {*} contextoAnterior 
     */
    function criarContexto(dispositivoLexML, contextoAnterior) {
        switch (dispositivoLexML.tagName) {
            case 'Artigo':
                return new ContextoTransformacaoArtigo(dispositivoLexML, contextoAnterior);

            case 'Parte':
            case 'Titulo':
            case 'Capitulo':
            case 'Secao':
            case 'Subsecao':
                return new ContextoTransformacaoAgrupador(dispositivoLexML, contextoAnterior);
                
            default:
                return new ContextoTransformacao(dispositivoLexML, contextoAnterior);
        }
    }

    let raiz = document.createElementNS('http://www.lexml.gov.br/1.0', 'Articulacao');
    let contexto = new ContextoTransformacao(raiz);

    // Se for o container de edição, então movemos para o primeiro filho.
    if (dispositivoDOM.classList.contains('silegismg-editor-articulacao')) {
        dispositivoDOM = dispositivoDOM.firstElementChild;
    }

    while (dispositivoDOM) {
        let tipo = dispositivoDOM.getAttribute('data-tipo').replace(/^[a-z]/, letra => letra.toUpperCase());

        if (tipo === 'Continuacao') {
            let p = criarElementoP(dispositivoDOM);
            contexto.adicionarSubitem(p);
        } else {
            while (contexto && !contexto.possuiSubtipo(tipo)) {
                contexto = contexto.contextoAnterior;
            }

            if (!contexto) {
                throw new ArticulacaoInvalidaException(dispositivoDOM, 'Dispositivo do tipo "' + tipo.toLowerCase() + '" inesperado neste ponto.');
            }

            if (dispositivoDOM.classList.contains('emenda')) {
                contexto.nEmenda++;
            } else {
                contexto.nEmenda = 0;
            }

            let dispositivoLexML = criarElementoLexML(tipo, dispositivoDOM, contexto.getIdReferencia(tipo), contexto.contarSubitens(tipo), dispositivoDOM.classList.contains('unico'), contexto.nEmenda, rotulos);

            if (tipo === 'Paragrafo' && dispositivoDOM.classList.contains('unico')) {
                // Adiciona o sufixo "u" ao identificador do parágrafo único
                dispositivoLexML.id = dispositivoLexML.id + 'u';
            }

            if (contexto.nEmenda) {
                contexto.adicionarSubitemEmendado(dispositivoLexML);
            } else {
                contexto.adicionarSubitem(dispositivoLexML);
            }

            contexto = criarContexto(dispositivoLexML, contexto);
        }

        dispositivoDOM = dispositivoDOM.nextElementSibling;
    }

    return raiz;
}

function criarElementoLexML(tipo, conteudo, idPai, idxFilho, unico, nEmenda, rotulos) {
    var elemento, id;

    id = tipo.substr(0, 3).toLowerCase();
    id = idPai ? idPai + '_' + id : id;

    if (nEmenda) {
        id += idxFilho + '-' + nEmenda;
    } else {
        id += idxFilho + 1;
    }

    elemento = document.createElementNS('http://www.lexml.gov.br/1.0', tipo);
    elemento.setAttribute('id', id);

    elemento.appendChild(criarRotuloLexML(tipo, nEmenda ? idxFilho : idxFilho + 1, unico, nEmenda, rotulos));

    switch (tipo) {
        case 'Artigo':
            elemento.appendChild(criarCaputLexML(conteudo, id));
            break;

        // Agrupadores
        case 'Parte':
        case 'Livro':
        case 'Titulo':
        case 'Capitulo':
        case 'Secao':
        case 'Subsecao':
            elemento.appendChild(criarNomeAgrupador(conteudo));
            break;

        default:
            elemento.appendChild(criarElementoP(conteudo));
            break;
    }

    return elemento;
}

function criarRotuloLexML(tipo, numero, unico, nEmenda, rotulos) {
    var elemento = document.createElementNS('http://www.lexml.gov.br/1.0', 'Rotulo');

    switch (tipo) {
        case 'Artigo':
            if (nEmenda) {
                elemento.innerHTML = 'Art. ' + numero + (numero < 10 ? 'º-' : '-') + transformarLetra(nEmenda, true) + (numero < 10 ? rotulos.separadorArtigo : rotulos.separadorArtigoSemOrdinal);
            } else {
                elemento.innerHTML = 'Art. ' + numero + (numero < 10 ? 'º' + rotulos.separadorArtigo : rotulos.separadorArtigoSemOrdinal);
            }
            break;

        case 'Paragrafo':
            elemento.innerHTML = unico ? 'Parágrafo único' + rotulos.separadorParagrafoUnico : '§ ' + numero + (numero < 10 ? 'º' + rotulos.separadorParagrafo : rotulos.separadorParagrafoSemOrdinal);
            break;

        case 'Inciso':
            elemento.innerHTML = transformarNumeroRomano(numero) + rotulos.separadorInciso;
            break;

        case 'Alinea':
            elemento.textContent = transformarLetra(numero) + rotulos.separadorAlinea;
            break;

        case 'Item':
            elemento.innerHTML = numero + rotulos.separadorItem;
            break;

        case 'Titulo':
            elemento.textContent = 'Título ' + transformarNumeroRomano(numero);
            break;

        case 'Capitulo' :
            elemento.textContent = 'Capítulo ' + transformarNumeroRomano(numero);
            break;

        case 'Secao':
            elemento.textContent = 'Seção ' + transformarNumeroRomano(numero);
            break;

        case 'Subsecao':
            elemento.textContent = 'Subseção ' + transformarNumeroRomano(numero);
            break;

        default:
            throw "Tipo não suportado na formatação de rótulo: " + tipo;
    }

    return elemento;
}

function criarCaputLexML(caput, idPai) {
    var elemento = document.createElementNS('http://www.lexml.gov.br/1.0', 'Caput');
    var paragrafo = criarElementoP(caput);

    elemento.setAttribute('id', idPai + '_cpt');
    elemento.appendChild(paragrafo);
    normalizarParagrafo(paragrafo);

    return elemento;
}

function criarElementoP(paragrafo) {
    var elemento = document.createElementNS('http://www.lexml.gov.br/1.0', 'p');
    criarConteudoInline(paragrafo, elemento);
    normalizarParagrafo(elemento);
    return elemento;
}

function criarConteudoInline(origem, destino) {
    var arvore = document.createTreeWalker(origem, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null /* necesário no IE 11 */, null  /* necesário no IE 11 */);
    var atual = {
        /**
         * Objeto de contexto de exportação anterior (este mesmo objeto)
         */
        anterior: null,

        /**
         * Elemento que, se encontrado, deve retroceder o contexto. Utilizado para navegar
         * por elementos filhos e identificar quando o nível, na navegação, retrocede,
         * obrigando a retroceder também o contexto.
         */
        retrocederEm: null,

        /**
         * Elemento na nova árvore onde os itens serão inseridos.
         */
        destino: destino
    };
    var primeiroTexto = true, ultimoTexto = null;

    while (arvore.nextNode()) {
        let item = arvore.currentNode;

        if (item.parentNode === atual.retrocederEm) {
            atual = atual.anterior;
        }

        if (item.nodeType === Node.TEXT_NODE) {
            ultimoTexto = item.cloneNode();

            if (primeiroTexto) {
                primeiroTexto = false;
                ultimoTexto.textContent = ultimoTexto.textContent.replace(/^\s+/, '');
            }

            atual.destino.appendChild(ultimoTexto);
        } else if (htmlInline.has(item.tagName)) {
            let elemento = document.createElementNS('http://www.lexml.gov.br/1.0', item.tagName.toLowerCase());
            atual.destino.appendChild(elemento);
            atual = {
                anterior: atual,
                retrocederEm: item.parentNode,
                destino: elemento
            };
        } else if (item.tagName === 'BR') {
            // Ignora
        } else {
            throw new ArticulacaoInvalidaException(origem, 'Elemento não permitido: ' + item.tagName);
        }
    }

    if (ultimoTexto) {  
        ultimoTexto.textContent = ultimoTexto.textContent.replace(/\s+$/, '');
    }

    return destino;
}

function criarNomeAgrupador(elementoAgrupador) {
    var elemento = document.createElementNS('http://www.lexml.gov.br/1.0', 'NomeAgrupador');
    criarConteudoInline(elementoAgrupador, elemento);
    return elemento;
}

/**
 * Desmembra elementos P dentro de outro P, colocando-os no mesmo nível.
 * Exemplo: `<P><P>1</P><P>2</P></P>` vira `<P>1</P><P>2</P>`
 * 
 * @param {Element} paragrafo
 */
function normalizarParagrafo(paragrafo) {
    while (paragrafo.hasAttributes()) {
        paragrafo.removeAttribute(paragrafo.attributes[0].name);
    }

    /* Microsoft Edge não implementa a interface HTMLElement em document.createElementNS.
     * Portanto, usaremos children se disponível, ou childNodes, para o Edge.
     */
    let itens = paragrafo.children || paragrafo.childNodes;

    for (let i = 0; i < itens.length; i++) {
        if (itens[i].tagName === 'p') {
            /* Tag P dentro de P. Isso não deveria ocorrer, então vamos tratar como continuação.
             * Neste caso, move-se todos os elementos a partir do índice 'i'
             * para novos parágrafos após o atual.
             */
            while (itens.length > i) {
                let item = itens[i];

                if (item.tagName === 'p') {
                    paragrafo.parentNode.insertBefore(item, paragrafo.nextSibling);
                    normalizarParagrafo(item);
                } else {
                    var novoParagrafo = document.createElementNS('http://www.lexml.gov.br/1.0', 'p');
                    novoParagrafo.appendChild(item);
                    paragrafo.parentNode.insertBefore(novoParagrafo, paragrafo.nextSibling);
                    normalizarParagrafo(novoParagrafo);
                }
            }
        }
    }
}

/**
 * Escreve o número em romano.
 * 
 * @param {Number} numero 
 */
function transformarNumeroRomano(numero) {
    var digitos = String(numero).split(""),
        tabela = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM",
            "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC",
            "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"],
        resultado = "",
        i = 3;

    while (i--) {
        resultado = (tabela[+digitos.pop() + (i * 10)] || "") + resultado;
    }
    return new Array(+digitos.join("") + 1).join("M") + resultado;
}

/**
 * Escreve o número em letra.
 * 
 * @param {Number} numero 
 */
function transformarLetra(numero, maiuscula) {
    if (numero < 1) {
        throw "Número deve ser positivo.";
    }

    return String.fromCharCode((maiuscula ? 64  : 96) + numero);
}

export default exportarParaLexML;