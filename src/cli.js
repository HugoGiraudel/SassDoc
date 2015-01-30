let doc = `
Usage:
  sassdoc <src>... [options]
  sassdoc [options]

Arguments:
  <src>  Path to your Sass folder.

Options:
  -h, --help            Bring help.
  --version             Show version.
  -v, --verbose         Enable verbose mode.
  -d, --dest=<dir>      Documentation folder [default: sassdoc].
  -c, --config=<path>   Path to JSON/YAML configuration file.
  -t, --theme=<name>    Theme to use.
  -p, --parse           Parse the input and output JSON data to stdout.
  --no-update-notifier  Disable update notifier check.
  --strict              Turn warnings into errors.
  --debug               Output debugging information.
`;

const docopt = require('docopt').docopt;
const pkg = require('../package.json');
const Environment = require('./environment');
const Logger = require('./logger');
const sassdoc = require('./sassdoc');
const errors = require('./errors');

export default function cli(argv = process.argv.slice(2)) {
  let options = docopt(doc, { version: pkg.version, argv: argv });
  let logger = new Logger(options['--verbose'], options['--debug'] || process.env.SASSDOC_DEBUG);
  let env = new Environment(logger, options['--strict']);

  logger.debug('argv:', () => JSON.stringify(argv));

  env.on('error', error => {
    if (error instanceof errors.Warning) {
      process.exit(2);
    }

    process.exit(1);
  });

  env.load(options['--config']);

  // Ensure CLI options.
  ensure(env, options, {
    dest: '--dest',
    theme: '--theme',
    noUpdateNotifier: '--no-update-notifier',
  });

  env.postProcess();

  // Run update notifier if not explicitely disabled.
  if (!env.noUpdateNotifier) {
    require('./notifier')(pkg, logger);
  }

  let handler, cb;

  // Whether to parse only or to documentize.
  if (!options['--parse']) {
    handler = sassdoc;
    cb = () => {};
  } else {
    handler = sassdoc.parse;
    cb = data => console.log(JSON.stringify(data, null, 2));
  }

  if (!options['<src>'].length) {
    return env.emit('error', new errors.SassDocError('Expecting at least one `<src>`.'));
  }

  handler(options['<src>'], env).then(cb);
}

/**
 * Ensure that CLI options take precedence over configuration values.
 *
 * For each name/option tuple, if the option is set, override configuration
 * value.
 */
function ensure(env, options, names) {
  for (let k of Object.keys(names)) {
    let v = names[k];

    if (options[v]) {
      env[k] = options[v];
    }
  }
}
