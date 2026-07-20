"""
Assainissement du HTML riche (anti XSS stocké).

Le contenu des actualités et de certains champs de direction est saisi via un éditeur riche
(CKEditor) puis affiché côté client avec `dangerouslySetInnerHTML`. Sans nettoyage, un rédacteur
malveillant ou un compte compromis pourrait injecter du <script> exécuté par tous les lecteurs.

On nettoie donc systématiquement à l'ENREGISTREMENT avec nh3 (portage Python d'Ammonia, Rust) :
les balises/scripts dangereux, les gestionnaires d'événements (onclick, onerror…) et les URLs
`javascript:` sont supprimés, tout en conservant la mise en forme légitime de l'éditeur.
"""
from typing import Optional
import nh3

# Balises produites par CKEditor et jugées sûres (mise en forme, listes, liens, tableaux, images).
_ALLOWED_TAGS = {
    "p", "br", "span", "div", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
    "ul", "ol", "li", "blockquote", "a", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
    "pre", "code", "figure", "figcaption", "img",
    "table", "thead", "tbody", "tr", "td", "th", "caption",
}

# Attributs autorisés par balise. On garde `style`/`class` pour la mise en forme de l'éditeur
# (couleur, taille, alignement) : ce ne sont pas des vecteurs d'exécution de script.
_ALLOWED_ATTRIBUTES = {
    "*": {"style", "class"},
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "width", "height"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
}

# Schémas d'URL autorisés (bloque notamment `javascript:`).
_ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}


def sanitize_html(html: Optional[str]) -> str:
    """Nettoie un fragment HTML riche. Retourne '' si l'entrée est vide/None."""
    if not html:
        return ""
    return nh3.clean(
        html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        url_schemes=_ALLOWED_URL_SCHEMES,
        link_rel="noopener noreferrer",
    )


def sanitize_plain(text: Optional[str]) -> str:
    """Retire TOUT balisage HTML (pour les champs censés être du texte simple : chapeau, titres)."""
    if not text:
        return ""
    return nh3.clean(text, tags=set(), attributes={})
