import React from "react";
import PropTypes from "prop-types";

const SvgIcon = (props) => {
  const { iconClass, fill, className, alt } = props;

  return (
    <i aria-hidden="true">
      <svg className={className}>
        <use xlinkHref={"#icon-" + iconClass} fill={fill}>
          <title>{alt}</title>
        </use>
      </svg>
    </i>
  );
};

SvgIcon.propTypes = {
  // svg名字
  iconClass: PropTypes.string.isRequired,
  // 填充颜色
  fill: PropTypes.string,
  className: PropTypes.string,
  alt: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
};

SvgIcon.defaultProps = {
  fill: "currentColor",
};

export default SvgIcon;
