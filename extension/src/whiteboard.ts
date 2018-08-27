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
import * as moment from 'moment';
import * as vscode from 'vscode';
import * as vscode_helpers from 'vscode-helpers';

/**
 * Options for connecting to a whiteboard.
 */
export interface WhiteboardConnectionOptions {
    /**
     * The host address.
     */
    host?: string;
    /**
     * The TCP port.
     */
    port?: number;
    /**
     * Use secure HTTP or not.
     */
    secure?: boolean;
}

/**
 * A whiteboard file.
 */
export interface WhiteboardFile {
    /**
     * The whiteboard the file belongs to.
     */
    board: Whiteboard;
    /**
     * The timestamp, the file has created.
     */
    ctime: moment.Moment;
    /**
     * Deletes the file on the underlying board.
     */
    'delete': () => Promise<void>;
    /**
     * The timestamp, the file has modified.
     */
    mtime: moment.Moment;
    /**
     * The name of the file.
     */
    name: string;
    /**
     * The size of the file.
     */
    size: number;
}

/**
 * A whiteboard (connection).
 */
export class Whiteboard {
    private constructor(public readonly baseUrl: vscode.Uri) {
    }

    /**
     * Connects to a board.
     *
     * @param {WhiteboardConnectionOptions} [opts] The custom options.
     *
     * @return {Promise<Whiteboard>} The promise with the new instance.
     */
    public static async connect(opts?: WhiteboardConnectionOptions): Promise<Whiteboard> {
        if (_.isNil(opts)) {
            opts = <any>{};
        }

        let host = vscode_helpers.toStringSafe(opts.host).trim();
        if ('' === host) {
            host = 'localhost';
        }

        let port = parseInt(
            vscode_helpers.toStringSafe(opts.port).trim()
        );

        let secure = vscode_helpers.toBooleanSafe(opts.secure);
        if (isNaN(port)) {
            port = secure ? 443 : 80;
        }

        const BASE_URI = vscode.Uri.parse(
            `http${ secure ? 's' : '' }://${ host }:${ port }/api/`
        );

        const TEST_RESPONSE = await vscode_helpers.GET(BASE_URI);
        if ('whiteboard' !== vscode_helpers.normalizeString(TEST_RESPONSE.response.headers['x-ego'])) {
            throw new Error('No whiteboard host');
        }

        return new Whiteboard(BASE_URI);
    }

    /**
     * Returns the current content of the board.
     *
     * @return {Promise<Buffer>|null} The promise with the content.
     */
    public async getContent() {
        const RESPONSE = await vscode_helpers.GET(this.baseUrl);

        switch (RESPONSE.code) {
            case 200:
                return await RESPONSE.readBody();

            case 204:
                return null;
        }

        throw new Error(`Unexpected response code '${ RESPONSE.code }'`);
    }

    /**
     * Returns the current list of files of the board.
     *
     * @return {Promise<WhiteboardFile[]>|null} The promise with the list of files.
     */
    public async listFiles(): Promise<WhiteboardFile[]> {
        const RESPONSE = await vscode_helpers.GET(
            `${ this.baseUrl }files/`,
        );

        switch (RESPONSE.code) {
            case 200:
                return vscode_helpers.asArray(
                    JSON.parse(
                        (await RESPONSE.readBody()).toString('utf8'),
                    )
                ).map(f => this.toFileObject(f));

            case 204:
                return null;
        }

        throw new Error(`Unexpected response code '${ RESPONSE.code }'`);
    }

    /**
     * Sets the content of the board.
     *
     * @param [any} content The new content for the board.
     */
    public async setContent(content: any) {
        if (_.isNil(content)) {
            content = Buffer.alloc(0);
        }

        content = await vscode_helpers.asBuffer(content, 'utf8');

        const RESPONSE = await vscode_helpers.PUT(this.baseUrl, content);
        if (204 !== RESPONSE.code) {
            throw new Error(`Unexpected response code '${ RESPONSE.code }'`);
        }
    }

    private toFileObject(obj: any): WhiteboardFile {
        if (_.isNil(obj)) {
            return <any>obj;
        }

        return {
            board: this,
            ctime: moment.utc(vscode_helpers.toStringSafe(obj['ctime']).trim()),
            'delete': async function() {
                const ME: WhiteboardFile = this;

                const RESPONSE = await vscode_helpers.DELETE(
                    `${ ME.board.baseUrl }files/${ encodeURIComponent(vscode_helpers.toStringSafe(ME.name)) }`,
                );

                if (204 === RESPONSE.code) {
                    return;
                }

                if (404 === RESPONSE.code) {
                    throw new Error('File not found');
                }

                throw new Error(`Unexpected response code '${ RESPONSE.code }'`);
            },
            mtime: moment.utc(vscode_helpers.toStringSafe(obj['mtime']).trim()),
            name: vscode_helpers.toStringSafe(obj['name']),
            size: parseInt(vscode_helpers.toStringSafe(obj['size']).trim()),
        };
    }

    /**
     * Uploads a file.
     *
     * @param {string} name The name of the file.
     * @param {any} content The content of the file.
     *
     * @return Promise<WhiteboardFile> The promise with the file, that has been uploaded.
     */
    public async uploadFile(name: string, content: any): Promise<WhiteboardFile> {
        const RESPONSE = await vscode_helpers.POST(
            `${ this.baseUrl }files/${ encodeURIComponent(vscode_helpers.toStringSafe(name).trim()) }`,
            await vscode_helpers.asBuffer(content, 'utf8'),
        );

        if (200 !== RESPONSE.code) {
            throw new Error(`Unexpected response code '${ RESPONSE.code }'`);
        }

        return this.toFileObject(
            JSON.parse(
                (await RESPONSE.readBody()).toString('utf8'),
            )
        );
    }
}