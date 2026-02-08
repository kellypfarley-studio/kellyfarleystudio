import type React from "react";

export type PanelFrameProps = {
  title: string;
  headerHint?: React.ReactNode;
  left?: React.ReactNode;
  center?: React.ReactNode;
  hideHeader?: boolean;
  children: React.ReactNode;
};

export default function PanelFrame(props: PanelFrameProps) {
  return (
    <div className="card panelGridItem" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {props.hideHeader ? null : (
        <div className="panelHeader">
          <div className="panelTitle">{props.title}</div>
          {props.center ? <div className="panelHeaderCenter">{props.center}</div> : null}
          {props.headerHint ? <div className="panelHeaderHint">{props.headerHint}</div> : null}
        </div>
      )}

      <div className="panelBody" style={{ flex: 1, minHeight: 0 }}>
        {props.left ? (
          <div className="panelContentRow">
            <div className="leftToolbar">{props.left}</div>
            <div className="svgWrap">{props.children}</div>
          </div>
        ) : (
          props.children
        )}
      </div>
    </div>
  );
}
