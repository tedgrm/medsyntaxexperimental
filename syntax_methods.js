function bracketAncestorCount(element) {
    // number of brackets in ancestors
    let nodes = [];
    let element1 = element;
    nodes.push(element1);
    while (element1.parentElement) {
        if (element1.parentElement.classList.contains('brackets')) {
            nodes.unshift(element1.parentElement);
        }
        element1 = element1.parentElement;
    }
    return nodes.length;
}

function afterParseFuntion(str, targetElementId, hasError, savedLatestInputTime) {
    res = str;
    document.getElementById(targetElementId).innerHTML = res;

    // WARNINGS
    time = Date.now();

    // bracket warnings ( and )
    bracketOpenCount = (str.match(new RegExp('(\\()', 'gi')) || []).length;
    bracketCloseCount = (str.match(new RegExp('(\\))', 'gi')) || []).length;
    if (bracketOpenCount > bracketCloseCount) {
        document.getElementById(warningBracketOpenElementId).hidden = false;
        hasError = true;
    }
    if (bracketOpenCount < bracketCloseCount) {
        document.getElementById(warningBracketCloseElementId).hidden = false;
        hasError = true;
    }
    if (str.indexOf("(") > str.indexOf(")")) {
        document.getElementById(warningBracketCloseElementId).hidden = false;
        document.getElementById(warningBracketOpenElementId).hidden = false;
    }

    // bracket warnings [ and ]
    squareBracketOpenCount = (str.match(new RegExp('(\\[)', 'gi')) || []).length;
    squareBracketCloseCount = (str.match(new RegExp('(\\])', 'gi')) || []).length;
    if (squareBracketOpenCount > squareBracketCloseCount) {
        document.getElementById(warningSquareBracketOpenElementId).hidden = false;
        hasError = true;
    }
    if (squareBracketOpenCount < squareBracketCloseCount) {
        document.getElementById(warningSquareBracketCloseElementId).hidden = false;
        hasError = true;
    }
    if (str.indexOf("[") > str.indexOf("]")) {
        document.getElementById(warningSquareBracketCloseElementId).hidden = false;
        document.getElementById(warningSquareBracketOpenElementId).hidden = false;
    }

    //TODO does this "savedLatestInputTime != latestInputTime" thing even work?
    var hasAmbiguousAndError = false;
    if (hasError == false) {
        // ambiguous ANDs and ORs
        var ambiguousAndLen = $(".brackets .boolean.and").each(function () {
            if (hasAmbiguousAndError == true | savedLatestInputTime != latestInputTime) {
                return false; // breaks
            }
            $(this).siblings(".or").each(function () {
                    hasAmbiguousAndError = true;
                    return false; // breaks
                }
            )
        });

        var ambiguousAndLen = $(".search-string .boolean.and").each(function () {
            if (hasAmbiguousAndError == true | savedLatestInputTime != latestInputTime) {
                return false; // breaks
            }
            $(this).siblings(".or").each(function () {
                    hasAmbiguousAndError = true;
                    return false; // breaks
                }
            )
        });

        if (hasAmbiguousAndError) {
            // add boolean error classes

            $(".brackets .boolean.or").each(function () {
                if (savedLatestInputTime != latestInputTime) {
                    return false; // breaks
                }
                $(this).siblings(".and").each(function () {
                    if (savedLatestInputTime != latestInputTime) {
                        return false; // breaks
                    }
                    $(this).addClass("boolean-error-and");
                });
            });

            $(".brackets .boolean.and").each(function () {
                if (savedLatestInputTime != latestInputTime) {
                    return false; // breaks
                }
                $(this).siblings(".or").each(function () {
                    if (savedLatestInputTime != latestInputTime) {
                        return false; // breaks
                    }
                    $(this).addClass("boolean-error-or");
                });
            });

            $(".search-string .boolean.or").each(function () {
                if (savedLatestInputTime != latestInputTime) {
                    return false; // breaks
                }
                $(this).siblings(".and").each(function () {
                    if (savedLatestInputTime != latestInputTime) {
                        return false; // breaks
                    }
                    $(this).addClass("boolean-error-and");
                });
            });

            $(".search-string .boolean.and").each(function () {
                if (savedLatestInputTime != latestInputTime) {
                    return false; // breaks
                }
                $(this).siblings(".or").each(function () {
                    if (savedLatestInputTime != latestInputTime) {
                        return false; // breaks
                    }
                    $(this).addClass("boolean-error-or");
                });
            });

            document.getElementById(warningAmbiguousAndElementId).hidden = false;
            hasError = true;


        }
    }

    if (squareBracketOpenCount == squareBracketCloseCount
        && bracketOpenCount == bracketCloseCount
        && document.getElementById(warningQuotesElementId).hidden) {
        var elementForHover;
        $('#' + targetElementId + ' .search-string div').mousemove(function (event) {

            if (elementForHover != this) {
                if ($(this).hasClass('hover')) {
                    return false;
                }
                makeEditScope(targetElementId, this)
                elementForHover = this;
            }

            return false;
        });

    }

    // makeResizableTarget(targetElementId);
    console.log('duration: ' + (Date.now() - time) + 'ms');

}

function addHoverThisAndPrevElement(element) {
    if (!$(element).hasClass('brackets')) {
        $(element).off('mousedown');
        $(element).addClass('hover');
        $(element).mousedown(function (event) {
            hoverMouseDown();
        });
        addHoverThisAndPrevElement($(element).prev())

        // if ($(element).hasClass('bracket-open')) {
        //   leftBracketOpen = true;
        // } else {
        //   addHoverThisAndPrevElement($(element).prev())
        // }
    }
}

// Determine edit scope
function makeEditScope(targetElementId, element) {
    $('#' + targetElementId + ' div').removeClass('hover');
    $('#' + targetElementId + ' div').off('mousedown');

    var selectionForHover = $(element);
    if ($(element).parent().hasClass('square-brackets')) {
        element = $(element).parent();
    }

    if ($(element).hasClass('brackets')) {
        selectionForHover = $(element).addClass('hover');
        selectionForHover.mousedown(function (event) {
            hoverMouseDown();
        });
    }

    try {
        addHoverThisAndNextElement(element);
    } catch (err) {
        // handle errors
    }
    try {
        addHoverThisAndPrevElement(element);
    } catch (err) {
        // handle errors
    }

    // if (rightBracketClose && leftBracketOpen) {
    //   console.log('between open and close');
    //   selectionForHover = $(element).parent().addClass('hover');
    //   selectionForHover.mousedown(function (event) {
    //     hoverMouseDown();
    //   });
    // }

    // leftBracketOpen = false;
    // rightBracketClose = false;
}

function textAreaAdjust(element, updateHeight, targetWidth) {
    element.style.height = "50px";
    if (targetWidth > 0) {
        if (bracketAncestorCount(element) > 0) {
            element.style.width = (targetWidth) - (bracketAncestorCount(element) * 25) + "px";
            // console.log(bracketAncestorCount(element));
        }
    } else {
        element.style.width = ($(window).width() - 200) + "px";
    }
    if (updateHeight) {
        element.style.height = "1px";
        element.style.height = (12 + element.scrollHeight) + "px";
    }
}

function updateUrl(name, value) {
    // Construct URLSearchParams object instance from current URL querystring
    let queryParams = new URLSearchParams(window.location.search);

    // Set new or modify existing page value
    queryParams.set(name, value);

    // Replace current querystring with the new one
    history.replaceState(null, null, "?" + queryParams.toString());
    history.pushState(null, null, "?" + queryParams.toString());

    if (isWorkspaceIndex) {
        parentSrc = parent.document.getElementById("page_is_fresh_" + isWorkspaceIndex)
            .getAttribute("src");
        console.log(parentSrc);
        var targetSrc = "../index.html?" + queryParams;
        console.log(targetSrc);
        if (parentSrc !== targetSrc) {
            console.log(window.location);
            console.log(isWorkspaceIndex);
            console.log("page_is_fresh_" + isWorkspaceIndex);
            parent.document.getElementById("page_is_fresh_" + isWorkspaceIndex)
                .setAttribute("src", targetSrc);
        }
    }
}