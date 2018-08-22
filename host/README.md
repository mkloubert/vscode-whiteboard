# @egodigital/whiteboard

Module and command line application for [Node.js 8+](https://nodejs.org/), which provides a virtual whiteboard web app, written in [TypeScript](https://www.typescriptlang.org/).

## Table of contents

1. [Install](#install-)
   * [As application](#as-application-)
   * [As module](#as-module-)
2. [Documentation](#documentation-)
3. [Support and contribute](#support-and-contribute-)

### Install [[&uarr;](#table-of-contents)]

#### As application [[&uarr;](#install-)]

First run the following command to install globally:

```bash
npm install -g @egodigital/whiteboard
```

Then simply run

```bash
whiteboard
```

to start a host on port `80` for the current working directory.

You can access the board by opening http://localhost in your browser.

#### As module [[&uarr;](#install-)]

First run

```bash
npm install --save @egodigital/whiteboard
```

where your `package.json` file is stored.

Now you can import the module in your scripts:

```typescript
import * as whiteboard from '@egodigital/whiteboard';

const HOST = new whiteboard.WhiteboardHost({
    hostname: '0.0.0.0',
    port: 80,
    root: process.cwd()
});

await HOST.start();
```

### Documentation [[&uarr;](#table-of-contents)]

* API documentation can be found [here](https://egodigital.github.io/whiteboard/).

### Support and contribute [[&uarr;](#table-of-contents)]

You are very welcome to contribute by [opening an issue](https://github.com/egodigital/vscode-whiteboard/issues) and/or fork this repository.

To work with the code:

* clone [this repository](https://github.com/egodigital/vscode-whiteboard)
* create and change to a new branch, like `git checkout -b my_new_feature`
* run `npm install` from your project folder
* open that project folder in Visual Studio Code
* now you can edit and debug there
* to update the web app, run `npm run build` from your project folder
* commit your changes to your new branch and sync it with your forked GitHub repo
* make a [pull request](https://github.com/egodigital/vscode-whiteboard/pulls)
