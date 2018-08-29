/**
 * This file is part of the @egodigital/whiteboard distribution.
 * Copyright (c) e.GO Digital GmbH, Aachen, Germany (https://www.e-go-digital.com/)
 *
 * @egodigital/whiteboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * @egodigital/whiteboard is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as _ from 'lodash';
import * as fs from 'fs-extra';
import * as http from 'http';
import * as egoose from '@egodigital/egoose';
import * as express from 'express';
import * as mimeTypes from 'mime-types';
import * as moment from 'moment';
import * as path from 'path';
import * as pqueue from 'p-queue';
import * as sanitizeFilename from 'sanitize-filename';

/**
 * An extended HTTP request context.
 */
export interface Request extends express.Request {
}

/**
 * An extended HTTP response context.
 */
export interface Response extends express.Response {
}

interface SetupAppContext {
    readonly app: express.Express;
    readonly authenticator: WhiteboardUserAuthenticator;
    readonly cwd: string;
    readonly queue: pqueue;
}

interface WhiteboardFile {
    ctime: string;
    mtime: string;
    name: string;
    size: number;
}

/**
 * Options for a whiteboard.
 */
export interface WhiteboardHostOptions {
    /**
     * Custom logic to authentificate an user.
     */
    authenticator?: WhiteboardUserAuthenticator;
    /**
     * The custom hostname, the host should listen on.
     */
    hostname?: string;
    /**
     * The custom TCP port, the host should listen on.
     */
    port?: number;
    /**
     * The custom root directory.
     */
    root?: string;
}

/**
 * Logic to authentificate an user.
 *
 * @param {Request} req The request context.
 * @param
 */
export type WhiteboardUserAuthenticator = (req: Request, res: Response) => boolean | Promise<boolean>;

/**
 * A whiteboard host.
 */
export class WhiteboardHost {
    private _server: http.Server;

    /**
     * Initializes a new instance of that class.
     *
     * @param {WhiteboardHostOptions} [options] Custom options.
     */
    public constructor(public readonly options?: WhiteboardHostOptions) {
        if (_.isNil(this.options)) {
            this.options = <any>{};
        }
    }

    /**
     * Gets if the host is currently running or not.
     */
    public get isRunning(): boolean {
        return !_.isNil(this._server);
    }

    private setupApp(context: SetupAppContext) {
        const ROOT = path.resolve(
            path.join(context.cwd, '.whiteboard')
        );

        const GET_PATH = (relativePath: string) => {
            if (!fs.existsSync(ROOT)) {
                fs.mkdirsSync(ROOT);
            }

            const STAT = fs.lstatSync(ROOT);
            if (!STAT.isDirectory()) {
                throw new Error(`'${ ROOT }' is no directory`);
            }

            return path.resolve(
                path.join(ROOT, egoose.toStringSafe(relativePath))
            );
        };

        const GET_FILE_PATH = (filename: any) => {
            const FILES_DIR = GET_PATH('./files');

            if (!fs.existsSync(FILES_DIR)) {
                fs.mkdirsSync(FILES_DIR);
            }

            const FILE_PATH = path.resolve(
                path.join(
                    FILES_DIR, sanitizeFilename(
                        egoose.toStringSafe(filename).trim()
                    )
                )
            );
            if (FILE_PATH.startsWith(FILES_DIR + path.sep)) {
                return FILE_PATH;
            }

            return false;
        };

        const TO_WHITEBOARD_FILE = async function (file: string, stats?: fs.Stats): Promise<WhiteboardFile> {
            if (arguments.length < 2) {
                stats = await fs.lstat(file);
            }

            return {
                ctime: moment.utc(stats.ctime).toISOString(),
                mtime: moment.utc(stats.mtime).toISOString(),
                name: path.basename(file),
                size: stats.size,
            };
        };

        const AUTH_USER: express.RequestHandler = async (req: Request, res: Response, next) => {
            const IS_AUTHENTICATED = egoose.toBooleanSafe(
                await Promise.resolve(
                    context.authenticator(req, res)
                )
            );

            if (IS_AUTHENTICATED) {
                return next();
            }

            return res.status(401)
                .send();
        };

        // say that this here is cool stuff made by e.GO ;-)
        // https://e-go-digital.com/
        context.app.use((req, res, next) => {
            res.header('X-Powered-By', 'e.GO Digital GmbH');
            res.header('X-Ego', 'whiteboard');
            res.header('X-Tm-Mk', '197909052309');

            return next();
        });

        context.app.use(
            AUTH_USER,
            express.static(path.join(__dirname, './webapp')),
        );

        // get board
        context.app.get('/api', AUTH_USER, (req, res) => {
            return context.queue.add(async () => {
                const BOARD_FILE = GET_PATH('./board.md');
                if (fs.existsSync(BOARD_FILE)) {
                    const MD = await fs.readFile(BOARD_FILE);

                    return res.status(200)
                        .header('Content-Type', 'text/markdown; charset=utf-8')
                        .send(MD);
                }

                return res.status(204)
                    .send();
            });
        });

        // delete / clear board
        context.app.delete('/api', AUTH_USER, (req, res) => {
            return context.queue.add(async () => {
                const BOARD_FILE = GET_PATH('./board.md');
                if (fs.existsSync(BOARD_FILE)) {
                    await fs.unlink(BOARD_FILE);
                }

                return res.status(204)
                    .send();
            });
        });

        // update board
        context.app.put('/api', AUTH_USER, (req, res) => {
            return context.queue.add(async () => {
                const BOARD_FILE = GET_PATH('./board.md');

                await fs.writeFile(
                    BOARD_FILE,
                    await egoose.readAll(req),
                );

                return res.status(204)
                    .send();
            });
        });

        // list files
        context.app.get('/api/files', AUTH_USER, (req, res) => {
            return context.queue.add(async () => {
                let fileList: WhiteboardFile[] = [];

                const FILES_DIR = GET_PATH('./files');
                if (fs.existsSync(FILES_DIR)) {
                    const DIR_STAT = await fs.lstat(FILES_DIR);
                    if (DIR_STAT.isDirectory()) {
                        for (const ITEM of (await fs.readdir(FILES_DIR))) {
                            try {
                                const FILE_PATH = path.resolve(
                                    path.join(FILES_DIR, ITEM)
                                );

                                const ITEM_STAT = await fs.lstat(FILE_PATH);
                                if (ITEM_STAT.isFile()) {
                                    fileList.push(
                                        await TO_WHITEBOARD_FILE(FILE_PATH, ITEM_STAT)
                                    );
                                }
                            } catch { }
                        }
                    }
                }

                fileList = egoose.from(fileList)
                    .orderByDescending(x => x.mtime)
                    .thenBy(x => egoose.normalizeString(x.name))
                    .toArray();

                return res.status(200)
                    .header('Content-Type', 'application/json; charset=utf-8')
                    .send(JSON.stringify(fileList));
            });
        });

        // get file (content)
        context.app.get('/api/files/:filename', AUTH_USER, (req, res) => {
            return context.queue.add(async () => {
                const FILE_PATH = GET_FILE_PATH(req.params['filename']);
                if (false !== FILE_PATH) {
                    if (fs.existsSync(FILE_PATH)) {
                        const STAT = await fs.lstat(FILE_PATH);
                        if (STAT.isFile()) {
                            let mime = mimeTypes.lookup(FILE_PATH);
                            if (false === mime) {
                                mime = 'application/octet-stream';
                            }

                            const FILE_CONTENT = await fs.readFile(FILE_PATH);

                            return res.status(200)
                                .header('Content-Type', mime)
                                .header('Content-Disposition', `attachment; filename="${ path.basename(FILE_PATH) }"`)
                                .header('Content-Length', '' + FILE_CONTENT.length)
                                .send(FILE_CONTENT);
                        }
                    }

                    return res.status(404)
                        .send();
                }

                return res.status(400)
                    .send();
            });
        });

        // add file
        context.app.post('/api/files/:filename', AUTH_USER, (req, res) => {
            return context.queue.add(async () => {
                let filePath = GET_FILE_PATH(req.params['filename']);

                if (false !== filePath) {
                    const DIR = path.dirname(filePath);
                    const EXT = path.extname(filePath);
                    const NAME = path.basename(filePath, EXT);

                    // find unique file name
                    let index = -1;
                    let newFilePath = filePath;
                    while (fs.existsSync(newFilePath)) {
                        ++index;

                        newFilePath = path.join(
                            DIR, `${ NAME }-${ index }${ EXT }`
                        );
                    }

                    let dataToWrite = await egoose.readAll(req);
                    if ('1' === req.query['base64']) {
                        // input data is Base64 encoded

                        dataToWrite = new Buffer(
                            dataToWrite.toString('ascii').trim(),
                            'base64'
                        );
                    }

                    await fs.writeFile(
                        newFilePath, dataToWrite
                    );

                    return res.status(200)
                        .header('Content-Type', 'application/json; charset=utf-8')
                        .send(JSON.stringify( await TO_WHITEBOARD_FILE(newFilePath) ));
                }

                return res.status(400)
                    .send();
            });
        });

        // delete file
        context.app.delete('/api/files/:filename', AUTH_USER, (req, res) => {
            return context.queue.add(async () => {
                const FILE_PATH = GET_FILE_PATH(req.params['filename']);
                if (false !== FILE_PATH) {
                    if (fs.existsSync(FILE_PATH)) {
                        const STAT = await fs.lstat(FILE_PATH);
                        if (STAT.isFile()) {
                            await fs.unlink(FILE_PATH);

                            return res.status(204)
                                .send();
                        }
                    }

                    return res.status(404)
                        .send();
                }

                return res.status(400)
                    .send();
            });
        });
    }

    /**
     * Stops the host.
     *
     * @return {Promise<boolean>} The promise, that indicates, if operation was successful or not.
     */
    public stop(): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const OLD_SERVER = this._server;
            if (_.isNil(OLD_SERVER)) {
                resolve(false);
                return;
            }

            OLD_SERVER.once('error', (err) => {
                reject(err);
            });

            try {
                OLD_SERVER.close(() => {
                    this._server = null;

                    resolve(true);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Starts the host.
     *
     * @return {Promise<boolean>} The promise, that indicates, if operation was successful or not.
     */
    public start(): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            if (this.isRunning) {
                resolve(false);
                return;
            }

            try {
                let authenticator = this.options.authenticator;
                if (_.isNil(authenticator)) {
                    authenticator = () => true;
                }

                let hostname = egoose.normalizeString(this.options.hostname);
                if ('' === hostname) {
                    hostname = '0.0.0.0';
                }

                let port = parseInt(egoose.toStringSafe(this.options.port).trim());
                if (isNaN(port)) {
                    port = 80;
                }

                let root = egoose.toStringSafe(this.options.root);
                if (egoose.isEmptyString(root)) {
                    root = process.cwd();
                }
                if (!path.isAbsolute(root)) {
                    root = path.join(process.cwd(), root);
                }
                root = path.resolve(root);

                const NEW_APP = express();

                NEW_APP.once('error', (err) => {
                    reject(err);
                });

                this.setupApp({
                    app: NEW_APP,
                    authenticator: authenticator,
                    cwd: root,
                    queue: new pqueue({
                        autoStart: true,
                        concurrency: 1,
                    }),
                });

                const SERVER = NEW_APP.listen(port, hostname, () => {
                    this._server = SERVER;

                    resolve(true);
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}
