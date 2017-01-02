ALL := app.js app.css progress.js progress.css

all: $(ALL)

app.js: $(shell find src/js -name '*.js')
	npm -s run rollup -- -c src/app.config.js > $@

app.css: src/css/*
	npm -s run lessc -- src/css/app.less > $@

progress.js: $(shell find src/js -name '*.js')
	npm -s run rollup -- -c src/progress.config.js > $@

progress.css: src/css/*
	npm -s run lessc -- src/css/progress.less > $@

clean:
	rm -rf $(ALL)

.PHONY: all clean
