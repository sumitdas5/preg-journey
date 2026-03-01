package com.ammarakshitha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@SuppressWarnings("unused")
public class PreviousPregnancyDTO {
    private Integer pregnancyNumber;
    private String outcome;
    private String deliveryType;
    private String babyGender;
}
