'use strict';

/**
 * This file is part of the vscode-whiteboard distribution.
 * Copyright (c) e.GO Digital GmbH, Aachen, Germany (https://www.e-go-digital.com/)
 *
 * vscode-whiteboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * vscode-whiteboard is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as _ from 'lodash';
import * as fs from 'fs-extra';
import * as sanitizeFilename from 'sanitize-filename';
import * as vscode from 'vscode';
import * as vscode_helpers from 'vscode-helpers';
import * as whiteboard from './whiteboard';

interface WhiteboardConnection extends vscode.Disposable {
}

let extension: vscode.ExtensionContext;
let isDeactivating = false;
const KEY_LAST_CONNECT_TO = 'egoVSCodeWhiteboardLastConnectTo';
const WHITEBOARD_CONNECTION_QUEUE = vscode_helpers.createQueue();
let whiteboardConnections: WhiteboardConnection[] = [];

export async function activate(context: vscode.ExtensionContext) {
    extension = context;

    const WF = vscode_helpers.buildWorkflow();

    WF.next(() => {
        context.subscriptions.push(
            vscode.commands.registerCommand('extension.ego-digital.whiteboard.connectToBoard', async () => {
                try {
                    let connectTo = vscode_helpers.toStringSafe(
                        context.workspaceState.get(KEY_LAST_CONNECT_TO)
                    ).trim();
                    if ('' === connectTo) {
                        connectTo = 'http://localhost:80';
                    }

                    connectTo = await vscode.window.showInputBox({
                        placeHolder: 'Host and port of the whiteboard to connect to ...',
                        value: connectTo,
                    });
                    if (vscode_helpers.isEmptyString(connectTo)) {
                        return;
                    }

                    connectTo = connectTo.trim();
                    if (!connectTo.toLowerCase().startsWith('http:') && !connectTo.toLowerCase().startsWith('https:')) {
                        connectTo = 'http://' + connectTo;
                    }

                    const OPTS: whiteboard.WhiteboardConnectionOptions = {
                    };

                    const URL = vscode.Uri.parse(connectTo.trim());
                    switch (vscode_helpers.normalizeString(URL.scheme)) {
                        case 'http':
                            OPTS.secure = false;
                            break;

                        case 'https':
                            OPTS.secure = true;
                            break;
                    }

                    const HOST_AND_PORT = vscode_helpers.normalizeString(URL.authority);

                    const HOST_PORT_SEP = HOST_AND_PORT.indexOf(':');
                    if (HOST_PORT_SEP > -1) {
                        OPTS.host = HOST_AND_PORT.substr(0, HOST_PORT_SEP).trim();
                        OPTS.port = parseInt(HOST_AND_PORT.substr(HOST_PORT_SEP + 1).trim());
                    } else {
                        OPTS.host = HOST_AND_PORT;
                    }

                    if (vscode_helpers.isEmptyString(OPTS.host)) {
                        OPTS.host = 'localhost';
                    }

                    if (isNaN(OPTS.port)) {
                        OPTS.port = OPTS.secure ? 443 : 80;
                    }

                    context.workspaceState.update(
                        KEY_LAST_CONNECT_TO,
                        `http${ OPTS.secure ? 's' : '' }://${ OPTS.host }:${ OPTS.port }/`,
                    ).then(() => { }, (err) => {
                        showError(err);
                    });

                    WHITEBOARD_CONNECTION_QUEUE.add(async () => {
                        await addConnection(
                            await connectToBoard(OPTS)
                        );
                    });

                } catch (e) {
                    showError(e);
                }
            }),
        );
    });

    if (!isDeactivating) {
        await WF.start();
    }
}

function addConnection(conn: WhiteboardConnection) {
    whiteboardConnections.push(conn);

    extension.subscriptions.push(
        conn
    );
}

function removeConnection(conn: WhiteboardConnection) {
    whiteboardConnections = whiteboardConnections.filter(wbc => wbc !== conn);
}

async function connectToBoard(opts: whiteboard.WhiteboardConnectionOptions): Promise<vscode.Disposable> {
    const BOARD = await whiteboard.Whiteboard.connect(opts);

    let prefix = sanitizeFilename(`${ opts.host }_${ opts.port }`.trim());
    if (prefix.length > 32) {
        prefix = prefix.substr(0, 32).trim();
    }

    const TEMP_FILE = await vscode_helpers.tempFile(async (tf) => {
        await fs.writeFile(
            tf,
            await BOARD.getContent(), 'utf8',
        );

        return tf;
    }, {
        keep: true,
        prefix: `ego-wb-`,
        suffix: `-${ prefix.trim() }.md`,
    });

    const TRY_DELETE_TEMP_FILE = () => {
        try {
            fs.unlinkSync(TEMP_FILE);
        } catch { }
    };

    let closeEvent: vscode.Disposable;
    let contentUpdater: vscode.Disposable;
    let editor: vscode.TextEditor;
    const EDITOR_QUEUE = vscode_helpers.createQueue();
    let saveEvent: vscode.Disposable;

    let isDisposed = false;
    const CONNECTION: WhiteboardConnection = {
        dispose: function() {
            if (isDisposed) {
                return;
            }
            isDisposed = true;

            vscode_helpers.tryDispose(contentUpdater);
            vscode_helpers.tryDispose(closeEvent);
            vscode_helpers.tryDispose(saveEvent);

            TRY_DELETE_TEMP_FILE();
        },
    };

    const UPDATE_CONTENT = async () => {
        if (vscode.window.activeTextEditor !== editor) {
            return;
        }

        await EDITOR_QUEUE.add(async () => {
            try {
                const DOC = editor.document;
                if (!DOC || DOC.isDirty) {
                    return;
                }

                let content = await BOARD.getContent();
                if (_.isNil(content)) {
                    content = Buffer.alloc(0);
                }

                if (content.toString('utf8') !== await fs.readFile(TEMP_FILE, 'utf8')) {
                    await fs.writeFile(TEMP_FILE, content);
                }
            } catch { }
        });
    };

    try {
        editor = await vscode_helpers.openAndShowTextDocument(TEMP_FILE);

        contentUpdater = vscode_helpers.createInterval(UPDATE_CONTENT, 1000);

        // close editor
        extension.subscriptions.push(
            closeEvent = vscode.workspace.onDidCloseTextDocument(doc => {
                if (doc !== editor.document) {
                    return;
                }

                EDITOR_QUEUE.add(async () => {
                    await WHITEBOARD_CONNECTION_QUEUE.add(async () => {
                        CONNECTION.dispose();

                        await removeConnection(CONNECTION);
                    });
                }).then(() => {
                }, () => {
                });
            }),
        );

        // save editor
        extension.subscriptions.push(
            saveEvent = vscode.workspace.onDidSaveTextDocument(doc => {
                if (doc !== editor.document) {
                    return;
                }

                EDITOR_QUEUE.add(async () => {
                    if (!(await vscode_helpers.isFile(TEMP_FILE, false))) {
                        return;
                    }

                    await BOARD.setContent(
                        await fs.readFile(TEMP_FILE),
                    );
                }).then(() => {
                }, () => {
                });
            }),
        );
    } catch (e) {
        TRY_DELETE_TEMP_FILE();

        throw e;
    }

    return CONNECTION;
}

export function deactivate() {
    if (isDeactivating) {
        return;
    }
    isDeactivating = true;
}

/**
 * Shows an error.
 *
 * @param {any} err The error to show.
 */
export async function showError(err: any) {
    if (!_.isNil(err)) {
        return await vscode.window.showErrorMessage(
            `[ERROR] '${ vscode_helpers.toStringSafe(err) }'`
        );
    }
}
