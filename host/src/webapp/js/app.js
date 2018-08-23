

let boardLoader;
let fileLoader;
let isLoadingBoard = false;
let isLoadingFiles = false;
let lastBoardHtml;

function ego_apply_highlight(selector) {
    selector.find('pre code').each(function(i, block) {
        hljs.highlightBlock(block);
    });
}

function ego_apply_mermaid(element) {
    element.find('pre code.language-mermaid').each(function(i, block) {
        const CODE_BLOCK = jQuery(block);
        const PRE_BLOCK = CODE_BLOCK.parent();

        const MERMAID_DIV = jQuery( '<div class="mermaid ego-mermaid" />' );
        MERMAID_DIV.text( CODE_BLOCK.text() );

        PRE_BLOCK.replaceWith( MERMAID_DIV );
    });

    mermaid.init(undefined,
                 element.find('.ego-mermaid'));
}

function ego_from_markdown(md) {
    const CONVERTER = new showdown.Converter();

    const HTML = CONVERTER.makeHtml( ego_to_string(md) );

    const CONTENT = jQuery('<div class="ego-markdown" />');
    CONTENT.html( HTML );

    CONTENT.find('script')
           .remove();

    CONTENT.find('table')
           .addClass('table')
           .addClass('table-striped')
           .addClass('table-hover');

    // make images responsive
    CONTENT.find('img')
           .addClass('img-fluid');

    // task lists
    CONTENT.find('ul li.task-list-item input[type="checkbox"]').each(function() {
        const CHECKBOX = jQuery(this);
        const LI = CHECKBOX.parent();

        const UL = LI.parent();
        UL.attr('class', 'ego-task-list');

        const IS_CHECKED = CHECKBOX.prop('checked');

        CHECKBOX.remove();

        const LABEL = ego_to_string(LI.text()).trim();

        LI.html('');
        LI.attr('style', null);

        const NEW_CHECKBOX = jQuery('<div class="form-check">' + 
                                    '<input class="form-check-input" type="checkbox" value="1">' + 
                                    '<label class="form-check-label" />' + 
                                    '</div>');
        NEW_CHECKBOX.find('input.form-check-input')
                    .prop('checked', IS_CHECKED)
                    .prop('disabled', true);

        NEW_CHECKBOX.find('.form-check-label')
                    .text( LABEL );

        NEW_CHECKBOX.appendTo( LI );
    });

    CONTENT.find('a').each(function() {
        const A = jQuery(this);

        A.attr('target', '_blank');
    });

    return CONTENT;
}

function ego_is_nil(val) {
    return null === val ||
           'undefined' === typeof val;
}

function ego_load_board() {
    if (isLoadingBoard) {
        return;
    }
    isLoadingBoard = true;

    const BOARD = jQuery('#ego-board .ego-board-area');

    jQuery.ajax({
        url: '/api',
        method: 'GET',
        success: (response, statusText, jqXHR) => {
            let newContent = false;

            if (jqXHR) {
                switch (jqXHR.status) {
                    case 200:
                        newContent = ego_from_markdown(response);
                        break;

                    case 204:
                        newContent = $('<span />');
                        break;
                }
            }

            if (newContent) {
                if (lastBoardHtml !== newContent.html()) {
                    lastBoardHtml = newContent.html();

                    BOARD.html('')
                         .append(newContent);

                    ego_apply_mermaid(newContent);
                    ego_apply_highlight(newContent);
                }
            }
        },
        complete: () => {
            isLoadingBoard = false;
        }
    });
}

function ego_load_files() {
    if (isLoadingFiles) {
        return;
    }
    isLoadingFiles = true;

    const BOARD = jQuery('#ego-board .ego-board-area');
    const FILE_AREA = jQuery('#ego-board .ego-file-area');
    const FILES = FILE_AREA.find('.card-body');

    jQuery.ajax({
        url: '/api/files',
        method: 'GET',
        success: (response, statusText, jqXHR) => {
            if (200 === jqXHR.status) {
                if (response.length < 1) {
                    const NO_FILES_MSG = 'No files found.';

                    if (FILES.text() !== NO_FILES_MSG) {
                        FILE_AREA.hide();

                        BOARD.addClass('col-12')
                             .removeClass('col-9');

                        FILES.html('')
                             .text(NO_FILES_MSG);
                    }
                } else {
                    const EXISTING_TABLE = FILES.find('table');
                    if (EXISTING_TABLE.length > 0) {
                        const EXISTING_FILES = [];
                        EXISTING_TABLE.find('tbody tr.ego-file').each(function() {
                            const ROW = jQuery(this);

                            EXISTING_FILES.push({
                                name: ROW.find('.ego-filename').text(),
                                size: parseInt(ROW.attr('ego-size'))
                            });
                        });

                        const COMPARER = (x, y) => {
                            return x.name === y.name &&
                                   x.size === y.size;
                        };

                        if (Enumerable.from(EXISTING_FILES).sequenceEqual(response, COMPARER)) {
                            return;
                        }
                    }

                    FILES.html('');

                    const FILE_TABLE = jQuery('<table class="table table-hover">' + 
                                              '<tbody />' + 
                                              '</table>');

                    const FILE_TABLE_BODY = FILE_TABLE.find('tbody');

                    for (const F of response) {
                        const NEW_ROW = jQuery('<tr class="ego-file">' + 
                                               '<td class="ego-filename align-middle" />' + 
                                               '<td class="ego-functions" />' + 
                                               '</tr>');
                        NEW_ROW.attr('ego-size', '' + F.size);

                        NEW_ROW.find('.ego-filename').text(F.name);
                        
                        const DOWNLOAD_BTN = jQuery('<a class="btn btn-sm btn-primary" target="_blank">' + 
                                                    '<i class="fa fa-download" aria-hidden="true"></i>' + 
                                                    '</a>');
                        {
                            DOWNLOAD_BTN.attr('href', '/api/files/' + encodeURIComponent(F.name));

                            DOWNLOAD_BTN.attr('title', "Download '" + F.name + "' ...");

                            NEW_ROW.find('.ego-functions')
                                   .append(DOWNLOAD_BTN);
                        }

                        FILE_TABLE_BODY.append(NEW_ROW);
                    }

                    FILES.append(FILE_TABLE);

                    BOARD.addClass('col-9')
                         .removeClass('col-12');

                    FILE_AREA.show();
                }
            }
        },
        complete: () => {
            isLoadingFiles = false;
        }
    });
}

function ego_to_string(val) {
    if ('string' === typeof val) {
        return val;
    }

    if (ego_is_nil(val)) {
        return '';
    }

    return '' + val;
}

jQuery(() => {
    showdown.setFlavor('github');

    showdown.setOption('completeHTMLDocument', false);
    showdown.setOption('encodeEmails', true);
    showdown.setOption('ghCodeBlocks', true);
    showdown.setOption('ghCompatibleHeaderId', true);
    showdown.setOption('headerLevelStart', 3);
    showdown.setOption('openLinksInNewWindow', true);
    showdown.setOption('simpleLineBreaks', true);
    showdown.setOption('simplifiedAutoLink', true);
    showdown.setOption('strikethrough', true);
    showdown.setOption('tables', true);
    showdown.setOption('tasklists', true);
});

jQuery(() => {
    ego_load_board();

    boardLoader = setInterval(() => {
        ego_load_board();
    }, 1000);
});

jQuery(() => {
    ego_load_files();

    fileLoader = setInterval(() => {
        ego_load_files();
    }, 1000);
});
