
let editor;
let isLoadingBoard = false;
let isSavingBoard = false;

function ego_load_board() {
    if (!editor) {
        return;
    }

    if (isLoadingBoard) {
        return;
    }
    isLoadingBoard = true;

    jQuery.ajax({
        url: '/api',
        method: 'GET',
        success: (data, statusText, jqXHR) => {
            switch (jqXHR.status) {
                case 200:
                    editor.setValue('' + data);
                    break;

                case 204:
                    editor.setValue('');
                    break;
            }
        },
        complete: () => {
            isLoadingBoard = false;
        }
    });
}

function ego_save_board() {
    if (!editor) {
        return;
    }

    if (isSavingBoard) {
        return;
    }
    isSavingBoard = true;

    let newValue = editor.getValue();
    const BTN = jQuery('#ego-btn-save-whiteboard');

    jQuery.ajax({
        url: '/api',
        method: 'PUT',
        data: newValue,
        beforeSend: () => {
            BTN.addClass('disabled');
        },
        complete: () => {
            BTN.removeClass('disabled');

            isSavingBoard = false;
        }
    });
}

jQuery(() => {
    const EDITOR_OPTS = {
        dragDrop: true,
        lineNumbers: true,
        lineWrapping: true,
        mode: "text/x-markdown",
        autoRefresh: {
            delay: 500
        }
    };

    const TEXT_AREA = jQuery('<textarea />');
    jQuery('#ego-whiteboard-editor').append(TEXT_AREA);

    const NEW_EDITOR = CodeMirror.fromTextArea(TEXT_AREA[0], EDITOR_OPTS);

    editor = NEW_EDITOR;

    jQuery(document).on("keydown", function(e){
        if (e.ctrlKey && e.which == 83){
            ego_save_board();
            return false;
        }
    });
});

jQuery(() => {
    ego_load_board();
});
