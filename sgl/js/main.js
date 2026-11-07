// Связывает всё вместе: сначала редактор, по кнопке «В мир» локация,
// по кнопке «Персонаж» снова редактор.
(function () {
	'use strict';

	const editor = document.getElementById('editor');
	const hud = document.getElementById('hud');
	const world = SGLGame.init(document.getElementById('world'));
	document.getElementById('place-name').textContent = world.name;

	function play(look) {
		SGLEditor.hide();
		editor.hidden = true;
		hud.hidden = false;
		SGLGame.start(look);
	}

	function edit() {
		SGLGame.stop();
		hud.hidden = true;
		editor.hidden = false;
		SGLEditor.show();
	}

	SGLEditor.hasSaved();
	SGLEditor.init(play);
	document.getElementById('open-editor').addEventListener('click', edit);

	// за редактором видна локация: рисуем её один раз как фон
	SGLGame.start(Object.assign({}, SGLEditor.look));
	requestAnimationFrame(() => requestAnimationFrame(edit));
})();
