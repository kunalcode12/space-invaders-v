import {ActionManager, ExecuteCodeAction} from "@babylonjs/core";

export class InputController {

  constructor(scene) {
    scene.actionManager = new ActionManager(scene);
    this.inputMap = {};
    const shouldCaptureEvent = (event) => {
      const target = event.target;
      if (!target) return true;
      const tagName = target.tagName;
      if (!tagName) return true;
      const editableTags = ["INPUT", "TEXTAREA", "SELECT"];
      if (editableTags.includes(tagName)) return false;
      if (target.isContentEditable) return false;
      return true;
    };

    window.addEventListener("keydown", (event) => {
      if (!shouldCaptureEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      let keyPressed = event.key;
      if (event.key === " ") keyPressed = "space";
      this.inputMap[keyPressed.toLowerCase()] = true;
    });
    window.addEventListener("keyup", (event) => {
      if (!shouldCaptureEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      let keyPressed = event.key;
      if (event.key === " ") keyPressed = "space";
      this.inputMap[keyPressed.toLowerCase()] = false;
    });
  }
}
